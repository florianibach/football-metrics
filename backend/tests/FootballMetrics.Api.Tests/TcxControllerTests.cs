using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
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

    public record TcxUploadResponseDto(Guid Id, string FileName, DateTime UploadedAtUtc);
}
