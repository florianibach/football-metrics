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
    }

    public record TcxUploadResponseDto(Guid Id, string FileName, DateTime UploadedAtUtc);
}
