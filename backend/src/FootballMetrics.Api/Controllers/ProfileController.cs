using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly IUserProfileRepository _repository;

    public ProfileController(IUserProfileRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<ActionResult<UserProfileResponse>> GetProfile(CancellationToken cancellationToken)
    {
        var profile = await _repository.GetAsync(cancellationToken);
        return Ok(new UserProfileResponse(profile.PrimaryPosition, profile.SecondaryPosition, profile.MetricThresholds, profile.DefaultSmoothingFilter));
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

        var submittedThresholds = request.MetricThresholds ?? existingProfile.MetricThresholds;
        if (string.Equals(submittedThresholds.SprintSpeedThresholdMode, MetricThresholdModes.Adaptive, StringComparison.OrdinalIgnoreCase)
            && string.Equals(submittedThresholds.HighIntensitySpeedThresholdMode, MetricThresholdModes.Adaptive, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Sprint and high-intensity thresholds cannot both be adaptive because it creates ambiguous ordering. Keep at least one threshold fixed.");
        }

        var validationError = MetricThresholdProfile.Validate(submittedThresholds);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var thresholdsChanged =
            existingProfile.MetricThresholds.SprintSpeedThresholdMps != submittedThresholds.SprintSpeedThresholdMps ||
            !string.Equals(existingProfile.MetricThresholds.SprintSpeedThresholdMode, submittedThresholds.SprintSpeedThresholdMode, StringComparison.OrdinalIgnoreCase) ||
            existingProfile.MetricThresholds.HighIntensitySpeedThresholdMps != submittedThresholds.HighIntensitySpeedThresholdMps ||
            !string.Equals(existingProfile.MetricThresholds.HighIntensitySpeedThresholdMode, submittedThresholds.HighIntensitySpeedThresholdMode, StringComparison.OrdinalIgnoreCase) ||
            existingProfile.MetricThresholds.AccelerationThresholdMps2 != submittedThresholds.AccelerationThresholdMps2 ||
            !string.Equals(existingProfile.MetricThresholds.AccelerationThresholdMode, submittedThresholds.AccelerationThresholdMode, StringComparison.OrdinalIgnoreCase) ||
            existingProfile.MetricThresholds.DecelerationThresholdMps2 != submittedThresholds.DecelerationThresholdMps2 ||
            !string.Equals(existingProfile.MetricThresholds.DecelerationThresholdMode, submittedThresholds.DecelerationThresholdMode, StringComparison.OrdinalIgnoreCase);

        var normalizedSprintMode = NormalizeThresholdMode(submittedThresholds.SprintSpeedThresholdMode);
        var normalizedHighIntensityMode = NormalizeThresholdMode(submittedThresholds.HighIntensitySpeedThresholdMode);
        var normalizedAccelerationMode = NormalizeThresholdMode(submittedThresholds.AccelerationThresholdMode);
        var normalizedDecelerationMode = NormalizeThresholdMode(submittedThresholds.DecelerationThresholdMode);

        var normalizedThresholds = new MetricThresholdProfile
        {
            SprintSpeedThresholdMps = submittedThresholds.SprintSpeedThresholdMps,
            SprintSpeedThresholdMode = normalizedSprintMode,
            HighIntensitySpeedThresholdMps = submittedThresholds.HighIntensitySpeedThresholdMps,
            HighIntensitySpeedThresholdMode = normalizedHighIntensityMode,
            AccelerationThresholdMps2 = submittedThresholds.AccelerationThresholdMps2,
            AccelerationThresholdMode = normalizedAccelerationMode,
            DecelerationThresholdMps2 = submittedThresholds.DecelerationThresholdMps2,
            DecelerationThresholdMode = normalizedDecelerationMode,
            Version = thresholdsChanged ? existingProfile.MetricThresholds.Version + 1 : existingProfile.MetricThresholds.Version,
            UpdatedAtUtc = thresholdsChanged ? DateTime.UtcNow : existingProfile.MetricThresholds.UpdatedAtUtc
        };

        var profile = await _repository.UpsertAsync(
            new UserProfile
            {
                PrimaryPosition = primaryPosition,
                SecondaryPosition = secondaryPosition,
                MetricThresholds = normalizedThresholds,
                DefaultSmoothingFilter = normalizedDefaultSmoothingFilter
            },
            cancellationToken);

        return Ok(new UserProfileResponse(profile.PrimaryPosition, profile.SecondaryPosition, profile.MetricThresholds, profile.DefaultSmoothingFilter));
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
