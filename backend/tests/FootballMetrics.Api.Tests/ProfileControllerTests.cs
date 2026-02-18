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
        payload.MetricThresholds.Should().NotBeNull();
        TcxSmoothingFilters.Supported.Should().Contain(payload.DefaultSmoothingFilter);
    }

    [Fact]
    public async Task R1_5_04_Ac02_UpdateProfile_ShouldPersistOptionalSecondaryPosition()
    {
        var client = _factory.CreateClient();
        var request = new UpdateUserProfileRequest(PlayerPositions.FullBack, PlayerPositions.Winger, null, null);

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

        var invalidPrimaryResponse = await client.PutAsJsonAsync("/api/profile", new UpdateUserProfileRequest("", PlayerPositions.Winger, null, null));
        invalidPrimaryResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var invalidSecondaryResponse = await client.PutAsJsonAsync("/api/profile", new UpdateUserProfileRequest(PlayerPositions.Striker, "UnknownPosition", null, null));
        invalidSecondaryResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var duplicateResponse = await client.PutAsJsonAsync("/api/profile", new UpdateUserProfileRequest(PlayerPositions.Striker, PlayerPositions.Striker, null, null));
        duplicateResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task R1_5_05_Ac02_Ac03_UpdateProfile_ShouldValidateAndVersionMetricThresholds()
    {
        var client = _factory.CreateClient();

        var invalidRequest = new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, new MetricThresholdProfile
        {
            SprintSpeedThresholdMps = 3.0,
            HighIntensitySpeedThresholdMps = 2.0,
            AccelerationThresholdMps2 = 2.0,
            DecelerationThresholdMps2 = -2.0
        }, null);

        var invalidResponse = await client.PutAsJsonAsync("/api/profile", invalidRequest);
        invalidResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var validRequest = new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, new MetricThresholdProfile
        {
            SprintSpeedThresholdMps = 8.0,
            HighIntensitySpeedThresholdMps = 6.0,
            AccelerationThresholdMps2 = 2.5,
            DecelerationThresholdMps2 = -2.5
        }, null);

        var updateResponse = await client.PutAsJsonAsync("/api/profile", validRequest);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updated.Should().NotBeNull();
        updated!.MetricThresholds.SprintSpeedThresholdMps.Should().Be(8.0);
        updated.MetricThresholds.Version.Should().BeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task R1_5_08_Ac01_UpdateProfile_ShouldPersistDefaultSmoothingFilter()
    {
        var client = _factory.CreateClient();

        var updateResponse = await client.PutAsJsonAsync("/api/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, TcxSmoothingFilters.Butterworth));

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedPayload = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updatedPayload.Should().NotBeNull();
        updatedPayload!.DefaultSmoothingFilter.Should().Be(TcxSmoothingFilters.Butterworth);

        var getResponse = await client.GetAsync("/api/profile");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var getPayload = await getResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        getPayload.Should().NotBeNull();
        getPayload!.DefaultSmoothingFilter.Should().Be(TcxSmoothingFilters.Butterworth);
    }

    [Fact]
    public async Task R1_5_08_Ac01_UpdateProfile_ShouldRejectUnsupportedDefaultSmoothingFilter()
    {
        var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, "InvalidFilter"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
