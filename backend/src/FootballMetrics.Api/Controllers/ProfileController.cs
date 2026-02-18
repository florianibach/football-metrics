using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly IUserProfileRepository _repository;
    private readonly IMetricThresholdResolver _metricThresholdResolver;

    public ProfileController(IUserProfileRepository repository, IMetricThresholdResolver metricThresholdResolver)
    {
        _repository = repository;
        _metricThresholdResolver = metricThresholdResolver;
    }

    [HttpGet]
    public async Task<ActionResult<UserProfileResponse>> GetProfile(CancellationToken cancellationToken)
    {
        var profile = await _repository.GetAsync(cancellationToken);
        var effectiveThresholds = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken);
        return Ok(new UserProfileResponse(profile.PrimaryPosition, profile.SecondaryPosition, effectiveThresholds, profile.DefaultSmoothingFilter, profile.PreferredSpeedUnit));
    }

    [HttpPut]
    public async Task<ActionResult<UserProfileResponse>> UpdateProfile([FromBody] UpdateUserProfileRequest request, CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return BadRequest("Profile payload is required.");
        }

        var normalizedPrimary = NormalizeRequired(request.PrimaryPosition);
        if (normalizedPrimary is null)
        {
            return BadRequest($"Unsupported primary position. Supported values: {string.Join(", ", PlayerPositions.Supported)}.");
        }

        var primaryPosition = NormalizeSupportedPosition(normalizedPrimary);
        if (primaryPosition is null)
        {
            return BadRequest($"Unsupported primary position. Supported values: {string.Join(", ", PlayerPositions.Supported)}.");
        }

        var normalizedSecondary = NormalizeOptional(request.SecondaryPosition);
        var secondaryPosition = normalizedSecondary is null ? null : NormalizeSupportedPosition(normalizedSecondary);
        if (normalizedSecondary is not null && secondaryPosition is null)
        {
            return BadRequest($"Unsupported secondary position. Supported values: {string.Join(", ", PlayerPositions.Supported)}.");
        }

        if (string.Equals(primaryPosition, secondaryPosition, StringComparison.Ordinal))
        {
            return BadRequest("Secondary position must differ from primary position.");
        }

        var existingProfile = await _repository.GetAsync(cancellationToken);
        var normalizedDefaultSmoothingFilter = NormalizeDefaultSmoothingFilter(request.DefaultSmoothingFilter, existingProfile.DefaultSmoothingFilter);
        if (normalizedDefaultSmoothingFilter is null)
        {
            return BadRequest($"Unsupported default smoothing filter. Supported values: {string.Join(", ", TcxSmoothingFilters.Supported)}.");
        }

        var normalizedPreferredSpeedUnit = NormalizePreferredSpeedUnit(request.PreferredSpeedUnit, existingProfile.PreferredSpeedUnit);
        if (normalizedPreferredSpeedUnit is null)
        {
            return BadRequest($"Unsupported preferred speed unit. Supported values: {string.Join(", ", SpeedUnits.Supported)}.");
        }

        var submittedThresholds = request.MetricThresholds ?? existingProfile.MetricThresholds;

        // AC / fachlich: acceleration + deceleration are fixed-only
        submittedThresholds.AccelerationThresholdMps2 = submittedThresholds.AccelerationThresholdMps2;
        submittedThresholds.DecelerationThresholdMps2 = submittedThresholds.DecelerationThresholdMps2;

        submittedThresholds.MaxSpeedMode = NormalizeThresholdMode(submittedThresholds.MaxSpeedMode);
        submittedThresholds.MaxHeartRateMode = NormalizeThresholdMode(submittedThresholds.MaxHeartRateMode);

        var validationError = MetricThresholdProfile.Validate(submittedThresholds);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var thresholdsChanged =
            existingProfile.MetricThresholds.MaxSpeedMps != submittedThresholds.MaxSpeedMps ||
            !string.Equals(existingProfile.MetricThresholds.MaxSpeedMode, submittedThresholds.MaxSpeedMode, StringComparison.OrdinalIgnoreCase) ||
            existingProfile.MetricThresholds.MaxHeartRateBpm != submittedThresholds.MaxHeartRateBpm ||
            !string.Equals(existingProfile.MetricThresholds.MaxHeartRateMode, submittedThresholds.MaxHeartRateMode, StringComparison.OrdinalIgnoreCase) ||
            existingProfile.MetricThresholds.SprintSpeedPercentOfMaxSpeed != submittedThresholds.SprintSpeedPercentOfMaxSpeed ||
            existingProfile.MetricThresholds.HighIntensitySpeedPercentOfMaxSpeed != submittedThresholds.HighIntensitySpeedPercentOfMaxSpeed ||
            existingProfile.MetricThresholds.AccelerationThresholdMps2 != submittedThresholds.AccelerationThresholdMps2 ||
            existingProfile.MetricThresholds.DecelerationThresholdMps2 != submittedThresholds.DecelerationThresholdMps2;

        var normalizedThresholds = new MetricThresholdProfile
        {
            MaxSpeedMps = submittedThresholds.MaxSpeedMps,
            MaxSpeedMode = submittedThresholds.MaxSpeedMode,
            MaxHeartRateBpm = submittedThresholds.MaxHeartRateBpm,
            MaxHeartRateMode = submittedThresholds.MaxHeartRateMode,
            SprintSpeedPercentOfMaxSpeed = submittedThresholds.SprintSpeedPercentOfMaxSpeed,
            HighIntensitySpeedPercentOfMaxSpeed = submittedThresholds.HighIntensitySpeedPercentOfMaxSpeed,
            AccelerationThresholdMps2 = submittedThresholds.AccelerationThresholdMps2,
            DecelerationThresholdMps2 = submittedThresholds.DecelerationThresholdMps2,
            EffectiveMaxSpeedMps = submittedThresholds.EffectiveMaxSpeedMps,
            EffectiveMaxHeartRateBpm = submittedThresholds.EffectiveMaxHeartRateBpm,
            Version = thresholdsChanged ? existingProfile.MetricThresholds.Version + 1 : existingProfile.MetricThresholds.Version,
            UpdatedAtUtc = thresholdsChanged ? DateTime.UtcNow : existingProfile.MetricThresholds.UpdatedAtUtc
        };

        var profile = await _repository.UpsertAsync(
            new UserProfile
            {
                PrimaryPosition = primaryPosition,
                SecondaryPosition = secondaryPosition,
                MetricThresholds = normalizedThresholds,
                DefaultSmoothingFilter = normalizedDefaultSmoothingFilter,
                PreferredSpeedUnit = normalizedPreferredSpeedUnit
            },
            cancellationToken);

        var effectiveThresholds = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken);
        return Ok(new UserProfileResponse(profile.PrimaryPosition, profile.SecondaryPosition, effectiveThresholds, profile.DefaultSmoothingFilter, profile.PreferredSpeedUnit));
    }

    private static string? NormalizeDefaultSmoothingFilter(string? requestedFilter, string fallbackFilter)
    {
        if (string.IsNullOrWhiteSpace(requestedFilter))
        {
            return fallbackFilter;
        }

        return TcxSmoothingFilters.Supported.FirstOrDefault(filter =>
            string.Equals(filter, requestedFilter.Trim(), StringComparison.OrdinalIgnoreCase));
    }


    private static string? NormalizePreferredSpeedUnit(string? requestedUnit, string fallbackUnit)
    {
        if (string.IsNullOrWhiteSpace(requestedUnit))
        {
            return fallbackUnit;
        }

        return SpeedUnits.Supported.FirstOrDefault(unit =>
            string.Equals(unit, requestedUnit.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private static string? NormalizeSupportedPosition(string value)
        => PlayerPositions.Supported.FirstOrDefault(position => string.Equals(position, value, StringComparison.OrdinalIgnoreCase));

    private static string? NormalizeRequired(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeThresholdMode(string? requestedMode)
    {
        if (string.IsNullOrWhiteSpace(requestedMode))
        {
            return MetricThresholdModes.Fixed;
        }

        return MetricThresholdModes.Supported.FirstOrDefault(mode =>
            string.Equals(mode, requestedMode.Trim(), StringComparison.OrdinalIgnoreCase)) ?? MetricThresholdModes.Fixed;
    }
}
