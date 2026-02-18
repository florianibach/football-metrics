using FootballMetrics.Api.Api;
using FootballMetrics.Api.Api.V1;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.UseCases;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly IProfileUseCase _profileUseCase;

    public ProfileController(IProfileUseCase profileUseCase)
    {
        _profileUseCase = profileUseCase;
    }

    [HttpGet]
    public async Task<ActionResult<UserProfileResponseDto>> GetProfile(CancellationToken cancellationToken)
    {
        var profile = await _profileUseCase.GetProfileAsync(cancellationToken);
        return Ok(new UserProfileResponseDto(profile.PrimaryPosition, profile.SecondaryPosition, profile.MetricThresholds, profile.DefaultSmoothingFilter, profile.PreferredSpeedUnit));
    }

    [HttpPut]
    public async Task<ActionResult<UserProfileResponseDto>> UpdateProfile([FromBody] UpdateUserProfileRequestDto request, CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid profile payload", "Profile payload is required.", ApiErrorCodes.ValidationError);
        }

        var normalizedPrimary = ProfileUseCase.NormalizeRequired(request.PrimaryPosition);
        if (normalizedPrimary is null || ProfileUseCase.NormalizeSupportedPosition(normalizedPrimary) is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Unsupported position", $"Unsupported primary position. Supported values: {string.Join(", ", PlayerPositions.Supported)}.", ApiErrorCodes.ValidationError);
        }

        var normalizedSecondary = ProfileUseCase.NormalizeOptional(request.SecondaryPosition);
        var secondaryPosition = normalizedSecondary is null ? null : ProfileUseCase.NormalizeSupportedPosition(normalizedSecondary);
        if (normalizedSecondary is not null && secondaryPosition is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Unsupported position", $"Unsupported secondary position. Supported values: {string.Join(", ", PlayerPositions.Supported)}.", ApiErrorCodes.ValidationError);
        }

        if (string.Equals(ProfileUseCase.NormalizeSupportedPosition(normalizedPrimary), secondaryPosition, StringComparison.Ordinal))
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid profile payload", "Secondary position must differ from primary position.", ApiErrorCodes.ValidationError);
        }

        var existingProfile = await _profileUseCase.GetProfileAsync(cancellationToken);
        var normalizedDefaultSmoothingFilter = ProfileUseCase.NormalizeDefaultSmoothingFilter(request.DefaultSmoothingFilter, existingProfile.DefaultSmoothingFilter);
        if (normalizedDefaultSmoothingFilter is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Unsupported smoothing filter", $"Unsupported default smoothing filter. Supported values: {string.Join(", ", TcxSmoothingFilters.Supported)}.", ApiErrorCodes.ValidationError);
        }

        var normalizedPreferredSpeedUnit = ProfileUseCase.NormalizePreferredSpeedUnit(request.PreferredSpeedUnit, existingProfile.PreferredSpeedUnit);
        if (normalizedPreferredSpeedUnit is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Unsupported speed unit", $"Unsupported preferred speed unit. Supported values: {string.Join(", ", SpeedUnits.Supported)}.", ApiErrorCodes.ValidationError);
        }

        var submittedThresholds = request.MetricThresholds ?? existingProfile.MetricThresholds;
        submittedThresholds.MaxSpeedMode = ProfileUseCase.NormalizeThresholdMode(submittedThresholds.MaxSpeedMode);
        submittedThresholds.MaxHeartRateMode = ProfileUseCase.NormalizeThresholdMode(submittedThresholds.MaxHeartRateMode);

        var validationError = MetricThresholdProfile.Validate(submittedThresholds);
        if (validationError is not null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid threshold configuration", validationError, ApiErrorCodes.ValidationError);
        }

        var profile = await _profileUseCase.UpdateProfileAsync(
            new UpdateUserProfileRequest(request.PrimaryPosition, request.SecondaryPosition, request.MetricThresholds, request.DefaultSmoothingFilter, request.PreferredSpeedUnit),
            cancellationToken);

        return Ok(new UserProfileResponseDto(profile.PrimaryPosition, profile.SecondaryPosition, profile.MetricThresholds, profile.DefaultSmoothingFilter, profile.PreferredSpeedUnit));
    }
}
