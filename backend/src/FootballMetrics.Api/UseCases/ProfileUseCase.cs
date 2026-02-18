using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.Services;

namespace FootballMetrics.Api.UseCases;

public class ProfileUseCase : IProfileUseCase
{
    private readonly IUserProfileRepository _repository;
    private readonly IMetricThresholdResolver _metricThresholdResolver;

    public ProfileUseCase(IUserProfileRepository repository, IMetricThresholdResolver metricThresholdResolver)
    {
        _repository = repository;
        _metricThresholdResolver = metricThresholdResolver;
    }

    public async Task<UserProfile> GetProfileAsync(CancellationToken cancellationToken)
    {
        var profile = await _repository.GetAsync(cancellationToken);
        var effectiveThresholds = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken);
        profile.MetricThresholds = effectiveThresholds;
        return profile;
    }

    public async Task<UserProfile> UpdateProfileAsync(UpdateUserProfileRequest request, CancellationToken cancellationToken)
    {
        var normalizedPrimary = NormalizeRequired(request.PrimaryPosition)!;
        var primaryPosition = NormalizeSupportedPosition(normalizedPrimary)!;

        var normalizedSecondary = NormalizeOptional(request.SecondaryPosition);
        var secondaryPosition = normalizedSecondary is null ? null : NormalizeSupportedPosition(normalizedSecondary);

        var existingProfile = await _repository.GetAsync(cancellationToken);
        var normalizedDefaultSmoothingFilter = NormalizeDefaultSmoothingFilter(request.DefaultSmoothingFilter, existingProfile.DefaultSmoothingFilter)!;
        var normalizedPreferredSpeedUnit = NormalizePreferredSpeedUnit(request.PreferredSpeedUnit, existingProfile.PreferredSpeedUnit)!;

        var submittedThresholds = request.MetricThresholds ?? existingProfile.MetricThresholds;
        submittedThresholds.MaxSpeedMode = NormalizeThresholdMode(submittedThresholds.MaxSpeedMode);
        submittedThresholds.MaxHeartRateMode = NormalizeThresholdMode(submittedThresholds.MaxHeartRateMode);

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
        profile.MetricThresholds = effectiveThresholds;
        return profile;
    }

    public static string? NormalizeDefaultSmoothingFilter(string? requestedFilter, string fallbackFilter)
    {
        if (string.IsNullOrWhiteSpace(requestedFilter))
        {
            return fallbackFilter;
        }

        return TcxSmoothingFilters.Supported.FirstOrDefault(filter =>
            string.Equals(filter, requestedFilter.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public static string? NormalizePreferredSpeedUnit(string? requestedUnit, string fallbackUnit)
    {
        if (string.IsNullOrWhiteSpace(requestedUnit))
        {
            return fallbackUnit;
        }

        return SpeedUnits.Supported.FirstOrDefault(unit =>
            string.Equals(unit, requestedUnit.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public static string? NormalizeSupportedPosition(string value)
        => PlayerPositions.Supported.FirstOrDefault(position => string.Equals(position, value, StringComparison.OrdinalIgnoreCase));

    public static string? NormalizeRequired(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string NormalizeThresholdMode(string? requestedMode)
    {
        if (string.IsNullOrWhiteSpace(requestedMode))
        {
            return MetricThresholdModes.Fixed;
        }

        return MetricThresholdModes.Supported.FirstOrDefault(mode =>
            string.Equals(mode, requestedMode.Trim(), StringComparison.OrdinalIgnoreCase)) ?? MetricThresholdModes.Fixed;
    }
}
