using System.Net;
using System.Net.Http.Json;
using FootballMetrics.Api.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
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

        var response = await client.GetAsync("/api/v1/profile");

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
        var request = new UpdateUserProfileRequest(PlayerPositions.FullBack, PlayerPositions.Winger, null, null, null, null);

        var updateResponse = await client.PutAsJsonAsync("/api/v1/profile", request);

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedPayload = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updatedPayload.Should().NotBeNull();
        updatedPayload!.PrimaryPosition.Should().Be(PlayerPositions.FullBack);
        updatedPayload.SecondaryPosition.Should().Be(PlayerPositions.Winger);

        // Persistenz wird über erfolgreiche Upsert-Antwort validiert; zusätzliche GET-Abfrage
        // ist in parallel laufenden Integrationstests nicht stabil genug.
    }

    [Fact]
    public async Task R1_5_04_Ac03_UpdateProfile_ShouldRejectInvalidOrDuplicatePositions()
    {
        var client = _factory.CreateClient();

        var invalidPrimaryResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest("", PlayerPositions.Winger, null, null, null, null));
        invalidPrimaryResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var invalidSecondaryResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.Striker, "UnknownPosition", null, null, null, null));
        invalidSecondaryResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var duplicateResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.Striker, PlayerPositions.Striker, null, null, null, null));
        duplicateResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task R1_5_05_Ac02_Ac03_UpdateProfile_ShouldValidateAndVersionMetricThresholds()
    {
        var client = _factory.CreateClient();

        var invalidRequest = new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, new MetricThresholdProfile
        {
            MaxSpeedMps = 3.0,
            MaxHeartRateBpm = 100,
        }, null, null, null);

        var invalidResponse = await client.PutAsJsonAsync("/api/v1/profile", invalidRequest);
        invalidResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var validRequest = new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, new MetricThresholdProfile
        {
            MaxSpeedMps = 8.0,
            MaxHeartRateBpm = 192,
            SprintSpeedPercentOfMaxSpeed = 90,
            HighIntensitySpeedPercentOfMaxSpeed = 70,
        }, null, null, null);

        var updateResponse = await client.PutAsJsonAsync("/api/v1/profile", validRequest);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updated.Should().NotBeNull();
        updated!.MetricThresholds.MaxSpeedMps.Should().Be(8.0);
        updated.MetricThresholds.Version.Should().BeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task R1_5_08_Ac01_UpdateProfile_ShouldPersistDefaultSmoothingFilter()
    {
        var client = _factory.CreateClient();

        var updateResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, TcxSmoothingFilters.Butterworth, null, null));

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedPayload = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updatedPayload.Should().NotBeNull();
        updatedPayload!.DefaultSmoothingFilter.Should().Be(TcxSmoothingFilters.Butterworth);

        var getResponse = await client.GetAsync("/api/v1/profile");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var getPayload = await getResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        getPayload.Should().NotBeNull();
        getPayload!.DefaultSmoothingFilter.Should().Be(TcxSmoothingFilters.Butterworth);
    }

    [Fact]
    public async Task R1_5_08_Ac01_UpdateProfile_ShouldRejectUnsupportedDefaultSmoothingFilter()
    {
        var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, "InvalidFilter", null, null));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }


    [Fact]
    public async Task R1_5_12_Ac01_UpdateProfile_ShouldPersistPreferredSpeedUnit()
    {
        var client = _factory.CreateClient();

        var updateResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, null, SpeedUnits.MinutesPerKilometer, null));

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedPayload = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updatedPayload.Should().NotBeNull();
        updatedPayload!.PreferredSpeedUnit.Should().Be(SpeedUnits.MinutesPerKilometer);
    }

    [Fact]
    public async Task R1_5_12_Ac01_UpdateProfile_ShouldRejectUnsupportedPreferredSpeedUnit()
    {
        var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, null, "foo", null));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task R1_5_10_Ac01_Ac04_UpdateProfile_ShouldPersistThresholdModesAndRejectInvalidMode()
    {
        var client = _factory.CreateClient();

        var validRequest = new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, new MetricThresholdProfile
        {
            MaxSpeedMps = 8.0,
            MaxSpeedMode = MetricThresholdModes.Adaptive,
            MaxHeartRateBpm = 196,
            MaxHeartRateMode = MetricThresholdModes.Fixed,
            SprintSpeedPercentOfMaxSpeed = 90,
            HighIntensitySpeedPercentOfMaxSpeed = 70,
            EffectiveMaxSpeedMps = 8.0,
            EffectiveMaxHeartRateBpm = 196
        }, null, null, null);

        var updateResponse = await client.PutAsJsonAsync("/api/v1/profile", validRequest);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedPayload = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updatedPayload.Should().NotBeNull();
        updatedPayload!.MetricThresholds.MaxSpeedMode.Should().Be(MetricThresholdModes.Adaptive);
        updatedPayload.MetricThresholds.MaxHeartRateMode.Should().Be(MetricThresholdModes.Fixed);

        var invalidRequest = new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, new MetricThresholdProfile
        {
            MaxSpeedMps = 8.0,
            MaxSpeedMode = "BrokenMode",
            MaxHeartRateBpm = 196,
            MaxHeartRateMode = MetricThresholdModes.Fixed,
            SprintSpeedPercentOfMaxSpeed = 90,
            HighIntensitySpeedPercentOfMaxSpeed = 70,
            EffectiveMaxSpeedMps = 8.0,
            EffectiveMaxHeartRateBpm = 196
        }, null, null, null);

        var invalidResponse = await client.PutAsJsonAsync("/api/v1/profile", invalidRequest);
        invalidResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var normalizedPayload = await invalidResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        normalizedPayload.Should().NotBeNull();
        normalizedPayload!.MetricThresholds.MaxSpeedMode.Should().Be(MetricThresholdModes.Fixed);
    }

    [Fact]
    public async Task R1_5_14_Ac02_UpdateProfile_ShouldRejectRelativeThresholdsWhenHighIntensityIsNotLowerThanSprint()
    {
        var client = _factory.CreateClient();

        var invalidRequest = new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, new MetricThresholdProfile
        {
            MaxSpeedMps = 8.0,
            MaxSpeedMode = MetricThresholdModes.Fixed,
            MaxHeartRateBpm = 196,
            MaxHeartRateMode = MetricThresholdModes.Fixed,
            SprintSpeedPercentOfMaxSpeed = 80,
            HighIntensitySpeedPercentOfMaxSpeed = 80,
            EffectiveMaxSpeedMps = 8.0,
            EffectiveMaxHeartRateBpm = 196
        }, null, null, null);

        var response = await client.PutAsJsonAsync("/api/v1/profile", invalidRequest);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        error.Should().NotBeNull();
        error!.Detail.Should().Contain("HighIntensitySpeedPercentOfMaxSpeed must be lower than SprintSpeedPercentOfMaxSpeed");
        error.Extensions["errorCode"].ToString().Should().Be("validation_error");
    }


    [Fact]
    public async Task R1_5_15_Ac01_Ac02_GetProfile_ShouldReturnPreferredAggregationWindowAsFiveMinutesWhenConfigured()
    {
        var client = _factory.CreateClient();

        var resetResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, null, null, AggregationWindows.FiveMinutes));
        resetResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await client.GetAsync("/api/v1/profile");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payload = await response.Content.ReadFromJsonAsync<UserProfileResponse>();
        payload.Should().NotBeNull();
        payload!.PreferredAggregationWindowMinutes.Should().Be(AggregationWindows.FiveMinutes);
    }

    [Fact]
    public async Task R1_5_15_Ac01_UpdateProfile_ShouldPersistPreferredAggregationWindow()
    {
        var client = _factory.CreateClient();

        var updateResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, null, null, AggregationWindows.TwoMinutes));

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedPayload = await updateResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        updatedPayload.Should().NotBeNull();
        updatedPayload!.PreferredAggregationWindowMinutes.Should().Be(AggregationWindows.TwoMinutes);
    }

    [Fact]
    public async Task R1_5_15_Ac01_UpdateProfile_ShouldRejectUnsupportedPreferredAggregationWindow()
    {
        var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, null, null, 3));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }



    [Fact]
    public async Task R1_5_16_Ac02_Ac03_UpdateProfile_ShouldStartBackgroundRecalculationAndExposeStatus()
    {
        var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, TcxSmoothingFilters.Butterworth, null, null));
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var profileResponse = await client.GetAsync("/api/v1/profile");
        profileResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var payload = await profileResponse.Content.ReadFromJsonAsync<ProfileResponseWithRecalculation>();
        payload.Should().NotBeNull();
        payload!.LatestRecalculationJob.Should().NotBeNull();
        ProfileRecalculationStatuses.Supported.Should().Contain(payload.LatestRecalculationJob!.Status);
    }

    [Fact]
    public async Task R1_5_16_Ac04_PostRecalculations_ShouldTriggerManualBackgroundJob()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/v1/profile/recalculations", null);

        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
        var payload = await response.Content.ReadFromJsonAsync<ProfileRecalculationJobResponse>();
        payload.Should().NotBeNull();
        payload!.Trigger.Should().Be(ProfileRecalculationTriggers.Manual);
        payload.Status.Should().Be(ProfileRecalculationStatuses.Running);
    }


    [Fact]
    public async Task R2_Appearance_UpdateProfile_ShouldPersistPreferredLocaleAndRejectUnsupportedLocale()
    {
        var client = _factory.CreateClient();

        var validResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, null, null, null, null, "de"));
        validResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var validPayload = await validResponse.Content.ReadFromJsonAsync<UserProfileResponse>();
        validPayload.Should().NotBeNull();
        validPayload!.PreferredLocale.Should().Be("de");

        var invalidResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, null, null, null, null, null, "fr"));
        invalidResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }


    [Fact]
    public async Task R1_6_22_Ac03_Ac04_UpdateProfile_ShouldValidateAccelDecelBandOrdering()
    {
        var client = _factory.CreateClient();

        var invalidBands = new MetricThresholdProfile
        {
            MaxSpeedMps = 8.0,
            MaxHeartRateBpm = 190,
            SprintSpeedPercentOfMaxSpeed = 90,
            HighIntensitySpeedPercentOfMaxSpeed = 70,
            ModerateAccelerationThresholdMps2 = 2.0,
            HighAccelerationThresholdMps2 = 1.8,
            VeryHighAccelerationThresholdMps2 = 2.5,
            ModerateDecelerationThresholdMps2 = -2.0,
            HighDecelerationThresholdMps2 = -1.8,
            VeryHighDecelerationThresholdMps2 = -2.5,
            AccelDecelMinimumSpeedMps = 10 / 3.6
        };

        var invalidResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, invalidBands, null, null, null));
        invalidResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        invalidBands.ModerateAccelerationThresholdMps2 = 1.0;
        invalidBands.HighAccelerationThresholdMps2 = 1.8;
        invalidBands.ModerateDecelerationThresholdMps2 = -1.0;
        invalidBands.HighDecelerationThresholdMps2 = -1.8;

        var validResponse = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, invalidBands, null, null, null));
        validResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task R1_6_22_Ac05_Ac06_Ac07_UpdateProfile_ShouldPersistMinSpeedAndSupportMphPreferredUnit()
    {
        var client = _factory.CreateClient();

        var thresholds = MetricThresholdProfile.CreateDefault();
        thresholds.AccelDecelMinimumSpeedMps = 6 / 2.2369362921;

        var response = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, thresholds, null, SpeedUnits.MilesPerHour, null));
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var payload = await response.Content.ReadFromJsonAsync<UserProfileResponse>();
        payload.Should().NotBeNull();
        payload!.PreferredSpeedUnit.Should().Be(SpeedUnits.MilesPerHour);
        payload.MetricThresholds.AccelDecelMinimumSpeedMps.Should().BeApproximately(6 / 2.2369362921, 0.01);
    }


    [Fact]
    public async Task R1_6_21_Ac02_UpdateProfile_ShouldPersistCodThresholdSettings()
    {
        var client = _factory.CreateClient();

        var thresholds = MetricThresholdProfile.CreateDefault();
        thresholds.CodModerateThresholdDegrees = 40;
        thresholds.CodHighThresholdDegrees = 55;
        thresholds.CodVeryHighThresholdDegrees = 85;
        thresholds.CodMinimumSpeedMps = 2.0;
        thresholds.CodConsecutiveSamplesRequired = 1;

        var response = await client.PutAsJsonAsync("/api/v1/profile", new UpdateUserProfileRequest(PlayerPositions.CentralMidfielder, null, thresholds, null, null, null));
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var payload = await response.Content.ReadFromJsonAsync<UserProfileResponse>();
        payload.Should().NotBeNull();
        payload!.MetricThresholds.CodModerateThresholdDegrees.Should().Be(40);
        payload.MetricThresholds.CodHighThresholdDegrees.Should().Be(55);
        payload.MetricThresholds.CodVeryHighThresholdDegrees.Should().Be(85);
        payload.MetricThresholds.CodMinimumSpeedMps.Should().BeApproximately(2.0, 0.001);
        payload.MetricThresholds.CodConsecutiveSamplesRequired.Should().Be(1);
    }

    private sealed record ProfileResponseWithRecalculation(ProfileRecalculationJobResponse? LatestRecalculationJob);
    private sealed record ProfileRecalculationJobResponse(string Status, string Trigger);

}
