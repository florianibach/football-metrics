using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using FootballMetrics.Api.Controllers;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FootballMetrics.Api.Tests;

public class TcxControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public TcxControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(_ => { });
    }

    [Fact]
    public async Task Mvp01_Ac01_Ac04_UploadingValidTcx_ShouldReturnCreatedAndListEntry()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "sample.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var payload = await response.Content.ReadFromJsonAsync<TcxUploadResponseDto>();
        payload.Should().NotBeNull();
        payload!.FileName.Should().Be("sample.tcx");
        payload.UploadedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));

        var listResponse = await client.GetAsync("/api/tcx");
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var listPayload = await listResponse.Content.ReadFromJsonAsync<List<TcxUploadResponseDto>>();
        listPayload.Should().NotBeNull();
        listPayload!.Count.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Mvp02_Ac01_Ac02_UploadingValidTcx_ShouldPersistRawFileUnchangedAndLinkByUploadId()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"football-metrics-tests-{Guid.NewGuid():N}.db");
        var connectionString = $"Data Source={databasePath}";
        var client = CreateClientWithConnectionString(connectionString);

        const string tcxPayload = "<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>";
        using var form = CreateUploadForm("raw-payload.tcx", tcxPayload);

        var response = await client.PostAsync("/api/tcx/upload", form);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var uploadResponse = await response.Content.ReadFromJsonAsync<TcxUploadResponseDto>();
        uploadResponse.Should().NotBeNull();

        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();

        var command = connection.CreateCommand();
        command.CommandText = "SELECT Id, RawFileContent, UploadStatus FROM TcxUploads WHERE Id = $id";
        command.Parameters.AddWithValue("$id", uploadResponse!.Id.ToString());

        await using var reader = await command.ExecuteReaderAsync();
        (await reader.ReadAsync()).Should().BeTrue();
        reader.GetString(0).Should().Be(uploadResponse.Id.ToString());
        Encoding.UTF8.GetString((byte[])reader[1]).Should().Be(tcxPayload);
        reader.GetString(2).Should().Be(TcxUploadStatuses.Succeeded);
    }



    [Fact]
    public async Task Mvp02_Ac04_UploadingToSchemaWithStoredFilePathNotNull_ShouldPersistWithoutConstraintFailure()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"football-metrics-tests-{Guid.NewGuid():N}.db");
        var connectionString = $"Data Source={databasePath}";

        await using (var setupConnection = new SqliteConnection(connectionString))
        {
            await setupConnection.OpenAsync();
            var command = setupConnection.CreateCommand();
            command.CommandText = @"
                CREATE TABLE IF NOT EXISTS TcxUploads (
                    Id TEXT PRIMARY KEY,
                    FileName TEXT NOT NULL,
                    StoredFilePath TEXT NOT NULL,
                    RawFileContent BLOB NOT NULL,
                    ContentHashSha256 TEXT NOT NULL,
                    UploadStatus TEXT NOT NULL DEFAULT 'Succeeded',
                    FailureReason TEXT NULL,
                    UploadedAtUtc TEXT NOT NULL
                );";
            await command.ExecuteNonQueryAsync();
        }

        var client = CreateClientWithConnectionString(connectionString);
        const string tcxPayload = "<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>";
        using var form = CreateUploadForm("stored-path-required.tcx", tcxPayload);

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var uploadResponse = await response.Content.ReadFromJsonAsync<TcxUploadResponseDto>();
        uploadResponse.Should().NotBeNull();

        await using var verifyConnection = new SqliteConnection(connectionString);
        await verifyConnection.OpenAsync();
        var verifyCommand = verifyConnection.CreateCommand();
        verifyCommand.CommandText = "SELECT StoredFilePath FROM TcxUploads WHERE Id = $id";
        verifyCommand.Parameters.AddWithValue("$id", uploadResponse!.Id.ToString());

        var storedPath = (string?)await verifyCommand.ExecuteScalarAsync();
        storedPath.Should().NotBeNull();
        storedPath.Should().Be(string.Empty);
    }

    [Fact]
    public async Task Mvp02_Ac03_UploadingValidTcx_ShouldPersistSha256Hash()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"football-metrics-tests-{Guid.NewGuid():N}.db");
        var connectionString = $"Data Source={databasePath}";
        var client = CreateClientWithConnectionString(connectionString);

        const string tcxPayload = "<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>";
        using var form = CreateUploadForm("hash.tcx", tcxPayload);

        var response = await client.PostAsync("/api/tcx/upload", form);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var uploadResponse = await response.Content.ReadFromJsonAsync<TcxUploadResponseDto>();
        uploadResponse.Should().NotBeNull();

        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();

        var command = connection.CreateCommand();
        command.CommandText = "SELECT ContentHashSha256 FROM TcxUploads WHERE Id = $id";
        command.Parameters.AddWithValue("$id", uploadResponse!.Id.ToString());

        var hashInDatabase = (string?)await command.ExecuteScalarAsync();
        var expectedHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(tcxPayload)));
        hashInDatabase.Should().Be(expectedHash);
    }

    [Fact]
    public async Task Mvp02_Ac04_WhenStorageFails_ShouldReturnServerErrorAndMarkUploadAsFailed()
    {
        var repository = new ThrowingOnceRepository();
        var controller = new TcxController(repository, NullLogger<TcxController>.Instance);

        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes("<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>"));
        var file = new FormFile(stream, 0, stream.Length, "file", "failure-case.tcx")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/xml"
        };

        var result = await controller.UploadTcx(file, CancellationToken.None);
        var objectResult = result.Result.Should().BeOfType<Microsoft.AspNetCore.Mvc.ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);

        repository.Calls.Should().HaveCount(2);
        repository.Calls[1].UploadStatus.Should().Be(TcxUploadStatuses.Failed);
        repository.Calls[1].FailureReason.Should().Be("StorageError");
    }

    [Fact]
    public async Task Mvp02_Ac04_WhenFailedMarkerWithOriginalIdCannotBeSaved_ShouldPersistFallbackFailedMarker()
    {
        var repository = new ThrowingThenRejectingSameIdRepository();
        var controller = new TcxController(repository, NullLogger<TcxController>.Instance);

        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes("<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>"));
        var file = new FormFile(stream, 0, stream.Length, "file", "failure-fallback-case.tcx")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/xml"
        };

        var result = await controller.UploadTcx(file, CancellationToken.None);
        var objectResult = result.Result.Should().BeOfType<Microsoft.AspNetCore.Mvc.ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);

        repository.Calls.Should().HaveCount(3);
        repository.Calls[1].UploadStatus.Should().Be(TcxUploadStatuses.Failed);
        repository.Calls[2].UploadStatus.Should().Be(TcxUploadStatuses.Failed);
        repository.Calls[2].Id.Should().NotBe(repository.Calls[1].Id);
        repository.Calls[2].FailureReason.Should().Contain("OriginalUploadId");
    }

    [Fact]
    public async Task Mvp01_Ac02_UploadingNonTcx_ShouldReturnBadRequest()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm("sample.txt", "hello");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadAsStringAsync();
        error.Should().Contain("Only .tcx files are supported");
    }

    [Fact]
    public async Task Mvp01_Ac03_UploadingFileOverRequestLimit_ShouldReturnRequestEntityTooLargeOrBadRequest()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm("large.tcx", new string('a', 21 * 1024 * 1024));

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().BeOneOf(HttpStatusCode.RequestEntityTooLarge, HttpStatusCode.BadRequest);

        var error = await response.Content.ReadAsStringAsync();
        if (response.StatusCode == HttpStatusCode.BadRequest)
        {
            error.Should().Contain("File is too large");
        }
    }

    [Fact]
    public async Task Mvp01_Ac05_UploadingCorruptXml_ShouldReturnBadRequestWithRecoveryHint()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm("broken.tcx", "<TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadAsStringAsync();
        error.Should().Contain("corrupted XML");
        error.Should().Contain("create a new TCX export");
    }

    [Fact]
    public async Task Mvp01_Ac05_UploadingInvalidRootTcx_ShouldReturnBadRequestWithNextStep()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm("invalid-root.tcx", "<root><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></root>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadAsStringAsync();
        error.Should().Contain("File content is invalid");
        error.Should().Contain("export the file again from your device");
    }

    [Fact]
    public async Task Mvp01_Ac05_UploadingIncompleteTcx_ShouldReturnBadRequestWithNextStep()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm("incomplete.tcx", "<TrainingCenterDatabase><Activities /></TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadAsStringAsync();
        error.Should().Contain("incomplete");
        error.Should().Contain("export includes workout data");
    }


    [Fact]
    public async Task Mvp03_Ac01_Ac05_UploadingValidTcx_ShouldReturnExtractedSummaryWithConsistentUnits()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "mvp03.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><DistanceMeters>2000</DistanceMeters><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint><Trackpoint><Time>2026-02-16T10:01:30Z</Time><Position><LatitudeDegrees>50.0005</LatitudeDegrees><LongitudeDegrees>7.0005</LongitudeDegrees></Position><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var payload = await response.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        payload.Should().NotBeNull();
        payload!.Summary.Should().NotBeNull();
        payload.Summary.TrackpointCount.Should().Be(2);
        payload.Summary.DurationSeconds.Should().Be(90);
        payload.Summary.HeartRateMinBpm.Should().Be(120);
        payload.Summary.HeartRateAverageBpm.Should().Be(135);
        payload.Summary.HeartRateMaxBpm.Should().Be(150);
        payload.Summary.DistanceSource.Should().Be("CalculatedFromGps");
        payload.Summary.DistanceMeters.Should().BeGreaterThan(0);
        payload.Summary.FileDistanceMeters.Should().Be(2000);
        payload.Summary.QualityStatus.Should().Be("High");
        payload.Summary.QualityReasons.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Mvp03_Ac04_UploadingTcxWithoutGpsOrHeartRate_ShouldNotFailAndReturnMissingMarkers()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "mvp03-no-gps.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var payload = await response.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        payload.Should().NotBeNull();
        payload!.Summary.HasGpsData.Should().BeFalse();
        payload.Summary.DistanceMeters.Should().BeNull();
        payload.Summary.HeartRateAverageBpm.Should().BeNull();
        payload.Summary.QualityStatus.Should().Be("Low");
        payload.Summary.QualityReasons.Should().Contain(reason => reason.Contains("missing"));
    }



    [Fact]
    public async Task Mvp04_Ac01_Ac02_Ac03_UploadingTcxWithImplausibleJumps_ShouldReturnMediumQualityWithReasons()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "mvp04-jumps.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint><Trackpoint><Time>2026-02-16T10:00:01Z</Time><Position><LatitudeDegrees>50.01</LatitudeDegrees><LongitudeDegrees>7.01</LongitudeDegrees></Position><HeartRateBpm><Value>132</Value></HeartRateBpm></Trackpoint><Trackpoint><Time>2026-02-16T10:00:02Z</Time><Position><LatitudeDegrees>50.02</LatitudeDegrees><LongitudeDegrees>7.02</LongitudeDegrees></Position><HeartRateBpm><Value>133</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var payload = await response.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        payload.Should().NotBeNull();
        payload!.Summary.QualityStatus.Should().Be("Medium");
        payload.Summary.QualityReasons.Should().Contain(reason => reason.Contains("implausible GPS jumps"));
    }


    [Fact]
    public async Task Mvp05_Ac01_Ac02_GetUploads_ShouldIncludeSummaryFieldsForEachSession()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "mvp05-list.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint><Trackpoint><Time>2026-02-16T10:01:00Z</Time><Position><LatitudeDegrees>50.0005</LatitudeDegrees><LongitudeDegrees>7.0005</LongitudeDegrees></Position><HeartRateBpm><Value>132</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var uploadResponse = await client.PostAsync("/api/tcx/upload", form);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var listResponse = await client.GetAsync("/api/tcx");
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var payload = await listResponse.Content.ReadFromJsonAsync<List<TcxUploadResponseWithSummaryDto>>();
        payload.Should().NotBeNull();
        payload!.Should().Contain(item => item.FileName == "mvp05-list.tcx");
        payload[0].Summary.QualityStatus.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Mvp05_Ac04_GetUploadById_ShouldReturnSpecificSessionDetail()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "mvp05-detail.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var uploadResponse = await client.PostAsync("/api/tcx/upload", form);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await uploadResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        created.Should().NotBeNull();

        var detailResponse = await client.GetAsync($"/api/tcx/{created!.Id}");
        detailResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var detail = await detailResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        detail.Should().NotBeNull();
        detail!.Id.Should().Be(created.Id);
        detail.FileName.Should().Be("mvp05-detail.tcx");
    }

    private static MultipartFormDataContent CreateUploadForm(string fileName, string contentText)
    {
        var form = new MultipartFormDataContent();
        var content = new StringContent(contentText);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse("application/xml");
        form.Add(content, "file", fileName);
        return form;
    }

    private HttpClient CreateClientWithConnectionString(string connectionString)
    {
        var factory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.Single(s => s.ServiceType.Name == "ISqliteConnectionFactory");
                services.Remove(descriptor);
                services.AddSingleton<FootballMetrics.Api.Data.ISqliteConnectionFactory>(
                    _ => new FootballMetrics.Api.Data.SqliteConnectionFactory(connectionString));
            });
        });

        return factory.CreateClient();
    }

    private sealed class ThrowingOnceRepository : ITcxUploadRepository
    {
        public List<TcxUpload> Calls { get; } = new();

        public Task<TcxUpload> AddAsync(TcxUpload upload, CancellationToken cancellationToken = default)
        {
            Calls.Add(upload);
            if (Calls.Count == 1)
            {
                throw new InvalidOperationException("Simulated storage failure");
            }

            return Task.FromResult(upload);
        }

        public Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<TcxUpload>>(new List<TcxUpload>());

        public Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult<TcxUpload?>(null);
    }

    private sealed class ThrowingThenRejectingSameIdRepository : ITcxUploadRepository
    {
        public List<TcxUpload> Calls { get; } = new();
        private Guid? _firstFailedUploadId;

        public Task<TcxUpload> AddAsync(TcxUpload upload, CancellationToken cancellationToken = default)
        {
            Calls.Add(upload);

            if (Calls.Count == 1)
            {
                _firstFailedUploadId = upload.Id;
                throw new InvalidOperationException("Simulated initial storage failure");
            }

            if (Calls.Count == 2 && _firstFailedUploadId.HasValue && upload.Id == _firstFailedUploadId.Value)
            {
                throw new InvalidOperationException("Simulated duplicate/constraint failure on failed-marker with original id");
            }

            return Task.FromResult(upload);
        }

        public Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<TcxUpload>>(new List<TcxUpload>());

        public Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult<TcxUpload?>(null);
    }

    public record TcxUploadResponseDto(Guid Id, string FileName, DateTime UploadedAtUtc);

    public record TcxUploadResponseWithSummaryDto(Guid Id, string FileName, DateTime UploadedAtUtc, TcxSummaryDto Summary);

    public record TcxSummaryDto(
        DateTime? ActivityStartTimeUtc,
        double? DurationSeconds,
        int TrackpointCount,
        int? HeartRateMinBpm,
        int? HeartRateAverageBpm,
        int? HeartRateMaxBpm,
        double? DistanceMeters,
        bool HasGpsData,
        double? FileDistanceMeters,
        string DistanceSource,
        string QualityStatus,
        IReadOnlyList<string> QualityReasons);
}
