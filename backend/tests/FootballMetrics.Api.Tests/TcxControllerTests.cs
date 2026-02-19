using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using FootballMetrics.Api.Controllers;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
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
    public async Task R2_07_Ac01_HealthEndpoints_ShouldBeAvailable()
    {
        var client = _factory.CreateClient();

        var liveResponse = await client.GetAsync("/health/live");
        liveResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var readyResponse = await client.GetAsync("/health/ready");
        readyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task R2_07_Ac01_UploadValidationError_ShouldReturnProblemDetailsWithErrorCode()
    {
        var client = _factory.CreateClient();

        using var form = CreateUploadForm("empty.tcx", string.Empty);
        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["errorCode"].ToString().Should().Be("validation_error");
    }


    [Fact]
    public async Task R2_07_Ac01_Responses_ShouldContainCorrelationHeader()
    {
        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.Add("X-Correlation-ID", "test-correlation");

        var response = await client.SendAsync(request);

        response.Headers.Contains("X-Correlation-ID").Should().BeTrue();
        response.Headers.GetValues("X-Correlation-ID").Single().Should().Be("test-correlation");
    }


    [Fact]
    public async Task R2_09_ApiVersioningContract_V1AndLegacyRoutes_ShouldReturnEquivalentPayloadShape()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "contract-v1.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var created = await client.PostAsync("/api/v1/tcx/upload", form);
        created.StatusCode.Should().Be(HttpStatusCode.Created);

        var payload = await created.Content.ReadFromJsonAsync<TcxUploadResponseDto>();
        payload.Should().NotBeNull();

        var legacyResponse = await client.GetAsync($"/api/tcx/{payload!.Id}");
        var v1Response = await client.GetAsync($"/api/v1/tcx/{payload.Id}");

        legacyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        v1Response.StatusCode.Should().Be(HttpStatusCode.OK);

        var legacyPayload = await legacyResponse.Content.ReadFromJsonAsync<TcxUploadResponseDto>();
        var v1Payload = await v1Response.Content.ReadFromJsonAsync<TcxUploadResponseDto>();

        legacyPayload.Should().BeEquivalentTo(v1Payload);
    }


    [Fact]
    public async Task R2_05_AdaptiveStats_ShouldPersistOnUpload()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"football-metrics-tests-{Guid.NewGuid():N}.db");
        var connectionString = $"Data Source={databasePath}";
        var client = CreateClientWithConnectionString(connectionString);

        using var form = CreateUploadForm(
            "adaptive-stats.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Lap><Track>" +
            "<Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>" +
            "<Trackpoint><Time>2026-02-16T10:00:10Z</Time><Position><LatitudeDegrees>50.0003</LatitudeDegrees><LongitudeDegrees>7.0003</LongitudeDegrees></Position><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>" +
            "</Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var upload = await response.Content.ReadFromJsonAsync<TcxUploadResponseDto>();
        upload.Should().NotBeNull();

        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();

        var command = connection.CreateCommand();
        command.CommandText = "SELECT MaxSpeedMps, MaxHeartRateBpm FROM TcxAdaptiveStats WHERE UploadId = $uploadId";
        command.Parameters.AddWithValue("$uploadId", upload!.Id.ToString());

        await using var reader = await command.ExecuteReaderAsync();
        (await reader.ReadAsync()).Should().BeTrue();
        reader.IsDBNull(0).Should().BeFalse();
        reader.GetDouble(0).Should().BeGreaterThan(0);
        reader.IsDBNull(1).Should().BeFalse();
        reader.GetInt32(1).Should().Be(150);
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
        var controller = new TcxController(repository, CreateAdapterResolver(), new InMemoryUserProfileRepository(), new PassThroughMetricThresholdResolver(), NullLogger<TcxController>.Instance);

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
        var controller = new TcxController(repository, CreateAdapterResolver(), new InMemoryUserProfileRepository(), new PassThroughMetricThresholdResolver(), NullLogger<TcxController>.Instance);

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
        var error = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        error.Should().NotBeNull();
        error!.Detail.Should().Contain("currently not supported");
        error.Detail.Should().Contain("Supported formats: .tcx");
        error.Extensions["errorCode"].ToString().Should().Be("unsupported_file_type");
    }


    [Fact]
    public async Task R1_05_Ac01_Ac03_UploadingUnsupportedExtension_ShouldReturnClearFutureFormatMessage()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm("future-format.fit", "binary");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        error.Should().NotBeNull();
        error!.Detail.Should().Contain("'.fit'");
        error.Detail.Should().Contain("currently not supported");
        error.Detail.Should().Contain("logged for potential future support");
        error.Extensions["errorCode"].ToString().Should().Be("unsupported_file_type");
    }

    [Fact]
    public async Task R1_05_Ac01_Ac02_UploadingTcxWithUppercaseExtension_ShouldStillUseTcxAdapter()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "UPPERCASE.TCX",
            "<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Mvp01_Ac03_UploadingFileOverRequestLimit_ShouldReturnRequestEntityTooLargeOrBadRequest()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm("large.tcx", new string('a', 21 * 1024 * 1024));

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().BeOneOf(HttpStatusCode.RequestEntityTooLarge, HttpStatusCode.BadRequest);

        var error = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        if (response.StatusCode == HttpStatusCode.BadRequest)
        {
            error.Should().NotBeNull();
            error!.Detail.Should().Contain("File is too large");
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

        var session = payload!
            .Where(item => item.FileName == "mvp05-list.tcx")
            .OrderByDescending(item => item.UploadedAtUtc)
            .First();
        session.UploadedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
        session.Summary.ActivityStartTimeUtc.Should().NotBeNull();
        session.Summary.QualityStatus.Should().NotBeNullOrWhiteSpace();
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



    [Fact]
    public async Task R1_01_Ac04_UploadingTcx_ShouldReturnSmoothingTraceWithSelectedParameters()
    {
        var client = _factory.CreateClient();
        var profileResetResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, TcxSmoothingFilters.AdaptiveMedian, null));
        profileResetResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var form = CreateUploadForm(
            "r1-01-smoothing.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint><Trackpoint><Time>2026-02-16T10:00:01Z</Time><Position><LatitudeDegrees>50.02</LatitudeDegrees><LongitudeDegrees>7.02</LongitudeDegrees></Position><HeartRateBpm><Value>132</Value></HeartRateBpm></Trackpoint><Trackpoint><Time>2026-02-16T10:00:05Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position><HeartRateBpm><Value>133</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var payload = await response.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        payload.Should().NotBeNull();
        payload!.Summary.Smoothing.Should().NotBeNull();
        payload.Summary.Smoothing.SelectedStrategy.Should().Be("AdaptiveMedian");
        payload.Summary.Smoothing.SelectedParameters.Should().ContainKey("EffectiveOutlierSpeedThresholdMps");
    }

    [Fact]
    public async Task R1_07_Ac01_Ac03_UpdatingSessionSmoothingFilter_ShouldPersistAndReturnUpdatedSummary()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "r1-07-filter.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position></Trackpoint><Trackpoint><Time>2026-02-16T10:00:05Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position></Trackpoint><Trackpoint><Time>2026-02-16T10:00:10Z</Time><Position><LatitudeDegrees>50.0004</LatitudeDegrees><LongitudeDegrees>7.0004</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var uploadResponse = await client.PostAsync("/api/tcx/upload", form);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await uploadResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        created.Should().NotBeNull();

        var putResponse = await client.PutAsJsonAsync($"/api/tcx/{created!.Id}/smoothing-filter", new { filter = "Butterworth" });
        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await putResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        updated.Should().NotBeNull();
        updated!.Summary.Smoothing.SelectedStrategy.Should().Be("Butterworth");
    }


    [Fact]
    public async Task R1_5_08_Ac02_UploadShouldUseProfileDefaultSmoothingFilter()
    {
        var client = _factory.CreateClient();

        var profileUpdate = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, TcxSmoothingFilters.Butterworth, null));
        profileUpdate.StatusCode.Should().Be(HttpStatusCode.OK);

        using var form = CreateUploadForm(
            "r1-5-08-profile-default.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position></Trackpoint><Trackpoint><Time>2026-02-16T10:00:05Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var uploadResponse = await client.PostAsync("/api/tcx/upload", form);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await uploadResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        created.Should().NotBeNull();
        created!.Summary.Smoothing.SelectedStrategy.Should().Be(TcxSmoothingFilters.Butterworth);
        created.SelectedSmoothingFilterSource.Should().Be(TcxSmoothingFilterSources.ProfileDefault);
        SpeedUnits.Supported.Should().Contain(created.SelectedSpeedUnit);
        created.SelectedSpeedUnitSource.Should().Be(TcxSpeedUnitSources.ProfileDefault);
    }

    [Fact]
    public async Task R1_5_08_Ac03_Ac04_ManualSessionFilterChange_ShouldMarkManualOverrideAndKeepTransparentSource()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "r1-5-08-manual-override.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position></Trackpoint><Trackpoint><Time>2026-02-16T10:00:05Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var uploadResponse = await client.PostAsync("/api/tcx/upload", form);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await uploadResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();

        var putResponse = await client.PutAsJsonAsync($"/api/tcx/{created!.Id}/smoothing-filter", new { filter = "Raw" });
        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await putResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        updated.Should().NotBeNull();
        updated!.Summary.Smoothing.SelectedStrategy.Should().Be(TcxSmoothingFilters.Raw);
        updated.SelectedSmoothingFilterSource.Should().Be(TcxSmoothingFilterSources.ManualOverride);
        updated.SelectedSpeedUnitSource.Should().Be(TcxSpeedUnitSources.ProfileDefault);
    }


    [Fact]
    public async Task R1_5_12_Ac03_Ac04_ManualSessionSpeedUnitChange_ShouldMarkManualOverrideAndKeepProfileDefaultIntact()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "speed-unit-override.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var uploadResponse = await client.PostAsync("/api/tcx/upload", form);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await uploadResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();

        var putResponse = await client.PutAsJsonAsync($"/api/tcx/{created!.Id}/speed-unit", new { speedUnit = "m/s" });
        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await putResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        updated.Should().NotBeNull();
        updated!.SelectedSpeedUnit.Should().Be(SpeedUnits.MetersPerSecond);
        updated.SelectedSpeedUnitSource.Should().Be(TcxSpeedUnitSources.ManualOverride);

        var profileResponse = await client.GetFromJsonAsync<UserProfileResponse>("/api/v1/profile");
        profileResponse.Should().NotBeNull();
        profileResponse!.PreferredSpeedUnit.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task R1_5_03_Ac01_Ac02_Ac03_Ac04_UpdateSessionContext_ShouldPersistAndReturnUpdatedContext()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "context.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var uploadResponse = await client.PostAsync("/api/tcx/upload", form);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await uploadResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        created.Should().NotBeNull();

        var updateResponse = await client.PutAsJsonAsync($"/api/tcx/{created!.Id}/session-context", new
        {
            sessionType = "Match",
            matchResult = "2:1",
            competition = "Cup",
            opponentName = "FC Example",
            opponentLogoUrl = "https://example.com/logo.png"
        });

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryAndContextDto>();
        updated.Should().NotBeNull();
        updated!.SessionContext.SessionType.Should().Be("Match");
        updated.SessionContext.MatchResult.Should().Be("2:1");
        updated.SessionContext.Competition.Should().Be("Cup");
        updated.SessionContext.OpponentName.Should().Be("FC Example");
        updated.SessionContext.OpponentLogoUrl.Should().Be("https://example.com/logo.png");
    }


    [Fact]
    public async Task R1_5_09_Ac01_Ac04_Recalculate_ShouldUseCurrentProfileAndExposeHistory()
    {
        var client = _factory.CreateClient();
        using var form = CreateUploadForm(
            "r1-5-09-recalc.tcx",
            "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position></Trackpoint><Trackpoint><Time>2026-02-16T10:00:05Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var uploadResponse = await client.PostAsync("/api/tcx/upload", form);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await uploadResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();

        var profileUpdate = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, new MetricThresholdProfile
        {
            MaxSpeedMps = 8.3,
            MaxHeartRateBpm = 191,
            AccelerationThresholdMps2 = 2.4,
            DecelerationThresholdMps2 = -2.6,
            Version = 1,
            UpdatedAtUtc = DateTime.UtcNow
        }, TcxSmoothingFilters.Butterworth, null));
        profileUpdate.StatusCode.Should().Be(HttpStatusCode.OK);

        var recalcResponse = await client.PostAsync($"/api/tcx/{created!.Id}/recalculate", content: null);
        recalcResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var recalculated = await recalcResponse.Content.ReadFromJsonAsync<TcxUploadResponseWithSummaryDto>();
        recalculated.Should().NotBeNull();
        recalculated!.Summary.Smoothing.SelectedStrategy.Should().Be(TcxSmoothingFilters.Butterworth);
        recalculated.SelectedSmoothingFilterSource.Should().Be(TcxSmoothingFilterSources.ProfileRecalculation);
        recalculated.SelectedSpeedUnit.Should().BeOneOf(SpeedUnits.KilometersPerHour, SpeedUnits.MinutesPerKilometer, SpeedUnits.MetersPerSecond);
        recalculated.SelectedSpeedUnitSource.Should().Be(TcxSpeedUnitSources.ProfileRecalculation);
        recalculated.AppliedProfileSnapshot.ThresholdVersion.Should().BeGreaterThanOrEqualTo(2);
        recalculated.RecalculationHistory.Should().HaveCount(1);
    }

    private static MultipartFormDataContent CreateUploadForm(string fileName, string contentText)
    {
        var form = new MultipartFormDataContent();
        var content = new StringContent(contentText);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse("application/xml");
        form.Add(content, "file", fileName);
        return form;
    }


    private static IUploadFormatAdapterResolver CreateAdapterResolver() =>
        new UploadFormatAdapterResolver(new IUploadFormatAdapter[] { new TcxUploadFormatAdapter() });

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

        public Task<bool> UpdateSessionContextAsync(Guid id, string sessionType, string? matchResult, string? competition, string? opponentName, string? opponentLogoUrl, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> UpdateSelectedSmoothingFilterAsync(Guid id, string selectedSmoothingFilter, CancellationToken cancellationToken = default)
            => Task.FromResult(false);
        public Task<bool> UpdateSelectedSmoothingFilterSourceAsync(Guid id, string selectedSmoothingFilterSource, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> UpdateSelectedSpeedUnitAsync(Guid id, string selectedSpeedUnit, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(true);
        }

        public Task<bool> UpdateSelectedSpeedUnitSourceAsync(Guid id, string selectedSpeedUnitSource, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(true);
        }

        public Task<bool> UpdateProfileSnapshotsAsync(Guid id, string metricThresholdSnapshotJson, string appliedProfileSnapshotJson, string recalculationHistoryJson, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> RecalculateSessionWithProfileAsync(Guid id, string selectedSmoothingFilter, string selectedSmoothingFilterSource, string selectedSpeedUnit, string selectedSpeedUnitSource, string metricThresholdSnapshotJson, string appliedProfileSnapshotJson, string recalculationHistoryJson, CancellationToken cancellationToken = default)
            => Task.FromResult(false);
        public Task<bool> UpdateSessionPreferencesAndSnapshotsAsync(
            Guid id,
            string? selectedSmoothingFilter,
            string? selectedSmoothingFilterSource,
            string? selectedSpeedUnit,
            string? selectedSpeedUnitSource,
            string? metricThresholdSnapshotJson,
            string? appliedProfileSnapshotJson,
            string? recalculationHistoryJson,
            CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task UpsertAdaptiveStatsAsync(Guid uploadId, double? maxSpeedMps, int? maxHeartRateBpm, DateTime calculatedAtUtc, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<(double? MaxSpeedMps, int? MaxHeartRateBpm)> GetAdaptiveStatsExtremesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<(double?, int?)>((null, null));

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

        public Task<bool> UpdateSessionContextAsync(Guid id, string sessionType, string? matchResult, string? competition, string? opponentName, string? opponentLogoUrl, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> UpdateSelectedSmoothingFilterAsync(Guid id, string selectedSmoothingFilter, CancellationToken cancellationToken = default)
            => Task.FromResult(false);
        public Task<bool> UpdateSelectedSmoothingFilterSourceAsync(Guid id, string selectedSmoothingFilterSource, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> UpdateSelectedSpeedUnitAsync(Guid id, string selectedSpeedUnit, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> UpdateSelectedSpeedUnitSourceAsync(Guid id, string selectedSpeedUnitSource, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> UpdateProfileSnapshotsAsync(Guid id, string metricThresholdSnapshotJson, string appliedProfileSnapshotJson, string recalculationHistoryJson, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> RecalculateSessionWithProfileAsync(Guid id, string selectedSmoothingFilter, string selectedSmoothingFilterSource, string selectedSpeedUnit, string selectedSpeedUnitSource, string metricThresholdSnapshotJson, string appliedProfileSnapshotJson, string recalculationHistoryJson, CancellationToken cancellationToken = default)
            => Task.FromResult(false);
        public Task<bool> UpdateSessionPreferencesAndSnapshotsAsync(
            Guid id,
            string? selectedSmoothingFilter,
            string? selectedSmoothingFilterSource,
            string? selectedSpeedUnit,
            string? selectedSpeedUnitSource,
            string? metricThresholdSnapshotJson,
            string? appliedProfileSnapshotJson,
            string? recalculationHistoryJson,
            CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task UpsertAdaptiveStatsAsync(Guid uploadId, double? maxSpeedMps, int? maxHeartRateBpm, DateTime calculatedAtUtc, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<(double? MaxSpeedMps, int? MaxHeartRateBpm)> GetAdaptiveStatsExtremesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<(double?, int?)>((null, null));

    }

    public record TcxUploadResponseDto(Guid Id, string FileName, DateTime UploadedAtUtc);

    public record TcxUploadResponseWithSummaryDto(Guid Id, string FileName, DateTime UploadedAtUtc, TcxSummaryDto Summary, string SelectedSmoothingFilterSource, string SelectedSpeedUnitSource, string SelectedSpeedUnit, AppliedProfileSnapshotDto AppliedProfileSnapshot, IReadOnlyList<SessionRecalculationEntryDto> RecalculationHistory);

    public record TcxUploadResponseWithSummaryAndContextDto(Guid Id, string FileName, DateTime UploadedAtUtc, TcxSummaryDto Summary, SessionContextDto SessionContext, string SelectedSmoothingFilterSource, string SelectedSpeedUnitSource, string SelectedSpeedUnit, AppliedProfileSnapshotDto AppliedProfileSnapshot, IReadOnlyList<SessionRecalculationEntryDto> RecalculationHistory);

    public record SessionContextDto(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);

    public record AppliedProfileSnapshotDto(int ThresholdVersion, DateTime ThresholdUpdatedAtUtc, string SmoothingFilter, DateTime CapturedAtUtc);

    public record SessionRecalculationEntryDto(DateTime RecalculatedAtUtc, AppliedProfileSnapshotDto PreviousProfile, AppliedProfileSnapshotDto NewProfile);

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
        IReadOnlyList<string> QualityReasons,
        TcxSmoothingDto Smoothing);

    public record TcxSmoothingDto(
        string SelectedStrategy,
        IReadOnlyDictionary<string, string> SelectedParameters,
        double? RawDistanceMeters,
        double? SmoothedDistanceMeters,
        int RawDirectionChanges,
        int BaselineDirectionChanges,
        int SmoothedDirectionChanges,
        int CorrectedOutlierCount,
        DateTime AnalyzedAtUtc);
}


internal sealed class InMemoryUserProfileRepository : IUserProfileRepository
{
    private UserProfile _profile = new();

    public Task<UserProfile> GetAsync(CancellationToken cancellationToken = default) => Task.FromResult(_profile);

    public Task<UserProfile> UpsertAsync(UserProfile profile, CancellationToken cancellationToken = default)
    {
        _profile = profile;
        return Task.FromResult(profile);
    }
}

internal sealed class PassThroughMetricThresholdResolver : IMetricThresholdResolver
{
    public Task<MetricThresholdProfile> ResolveEffectiveAsync(MetricThresholdProfile baseProfile, CancellationToken cancellationToken = default)
        => Task.FromResult(baseProfile);
}
