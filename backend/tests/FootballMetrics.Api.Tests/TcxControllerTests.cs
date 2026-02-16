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
    public async Task UploadingTcxFile_ShouldReturnCreated()
    {
        var client = _factory.CreateClient();
        using var form = new MultipartFormDataContent();
        var content = new StringContent("<TrainingCenterDatabase></TrainingCenterDatabase>");
        content.Headers.ContentType = MediaTypeHeaderValue.Parse("application/xml");
        form.Add(content, "file", "sample.tcx");

        var response = await client.PostAsync("/api/tcx/upload", form);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var listResponse = await client.GetAsync("/api/tcx");
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var payload = await listResponse.Content.ReadFromJsonAsync<List<TcxUploadResponseDto>>();
        payload.Should().NotBeNull();
        payload!.Count.Should().BeGreaterThan(0);
    }

    public record TcxUploadResponseDto(Guid Id, string FileName, DateTime UploadedAtUtc);
}
