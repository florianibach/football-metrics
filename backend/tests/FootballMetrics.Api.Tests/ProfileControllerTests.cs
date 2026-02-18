using System.Net;
using System.Net.Http.Json;
using FootballMetrics.Api.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace FootballMetrics.Api.Tests;

public class ProfileControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ProfileControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(_ => { });
    }

    [Fact]
    public async Task R1_5_04_Ac01_Ac04_GetProfile_ShouldReturnPrimaryPositionInSettingsViewModel()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/profile");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payload = await response.Content.ReadFromJsonAsync<UserProfileResponse>();
        payload.Should().NotBeNull();
        payload!.PrimaryPosition.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task R1_5_04_Ac02_UpdateProfile_ShouldPersistOptionalSecondaryPosition()
    {
        var client = _factory.CreateClient();
        var request = new UpdateUserProfileRequest(PlayerPositions.FullBack, PlayerPositions.Winger);

        var updateResponse = await client.PutAsJsonAsync("/api/profile", request);

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedPayload = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updatedPayload.Should().NotBeNull();
        updatedPayload!.PrimaryPosition.Should().Be(PlayerPositions.FullBack);
        updatedPayload.SecondaryPosition.Should().Be(PlayerPositions.Winger);

        var getResponse = await client.GetAsync("/api/profile");
        var getPayload = await getResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        getPayload.Should().NotBeNull();
        getPayload!.PrimaryPosition.Should().Be(PlayerPositions.FullBack);
        getPayload.SecondaryPosition.Should().Be(PlayerPositions.Winger);
    }

    [Fact]
    public async Task R1_5_04_Ac03_UpdateProfile_ShouldRejectInvalidOrDuplicatePositions()
    {
        var client = _factory.CreateClient();

        var invalidPrimaryResponse = await client.PutAsJsonAsync("/api/profile", new UpdateUserProfileRequest("", PlayerPositions.Winger));
        invalidPrimaryResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var invalidSecondaryResponse = await client.PutAsJsonAsync("/api/profile", new UpdateUserProfileRequest(PlayerPositions.Striker, "UnknownPosition"));
        invalidSecondaryResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var duplicateResponse = await client.PutAsJsonAsync("/api/profile", new UpdateUserProfileRequest(PlayerPositions.Striker, PlayerPositions.Striker));
        duplicateResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
