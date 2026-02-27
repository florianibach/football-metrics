using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.Services;

namespace FootballMetrics.Api.UseCases;

public class ProfileUseCase : IProfileUseCase
{
    private readonly IUserProfileRepository _repository;
    private readonly IMetricThresholdResolver _metricThresholdResolver;
    private readonly IProfileRecalculationOrchestrator _recalculationOrchestrator;
    private readonly IProfileRecalculationJobRepository _recalculationJobRepository;

    public ProfileUseCase(
        IUserProfileRepository repository,
        IMetricThresholdResolver metricThresholdResolver,
        IProfileRecalculationOrchestrator recalculationOrchestrator,
        IProfileRecalculationJobRepository recalculationJobRepository)
    {
        _repository = repository;
        _metricThresholdResolver = metricThresholdResolver;
        _recalculationOrchestrator = recalculationOrchestrator;
        _recalculationJobRepository = recalculationJobRepository;
    }

    public async Task<UserProfile> GetProfileAsync(CancellationToken cancellationToken)
    {
        var profile = await _repository.GetAsync(cancellationToken);
        var effectiveThresholds = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken: cancellationToken);
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
        var normalizedPreferredAggregationWindowMinutes = NormalizePreferredAggregationWindowMinutes(request.PreferredAggregationWindowMinutes, existingProfile.PreferredAggregationWindowMinutes) ?? existingProfile.PreferredAggregationWindowMinutes;
        var normalizedPreferredTheme = NormalizePreferredTheme(request.PreferredTheme, existingProfile.PreferredTheme)!;
        var normalizedPreferredLocale = NormalizePreferredLocale(request.PreferredLocale, existingProfile.PreferredLocale);

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
            existingProfile.MetricThresholds.ModerateAccelerationThresholdMps2 != submittedThresholds.ModerateAccelerationThresholdMps2 ||
            existingProfile.MetricThresholds.HighAccelerationThresholdMps2 != submittedThresholds.HighAccelerationThresholdMps2 ||
            existingProfile.MetricThresholds.VeryHighAccelerationThresholdMps2 != submittedThresholds.VeryHighAccelerationThresholdMps2 ||
            existingProfile.MetricThresholds.ModerateDecelerationThresholdMps2 != submittedThresholds.ModerateDecelerationThresholdMps2 ||
            existingProfile.MetricThresholds.HighDecelerationThresholdMps2 != submittedThresholds.HighDecelerationThresholdMps2 ||
            existingProfile.MetricThresholds.VeryHighDecelerationThresholdMps2 != submittedThresholds.VeryHighDecelerationThresholdMps2 ||
            existingProfile.MetricThresholds.AccelDecelMinimumSpeedMps != submittedThresholds.AccelDecelMinimumSpeedMps ||
            existingProfile.MetricThresholds.CodModerateThresholdDegrees != submittedThresholds.CodModerateThresholdDegrees ||
            existingProfile.MetricThresholds.CodHighThresholdDegrees != submittedThresholds.CodHighThresholdDegrees ||
            existingProfile.MetricThresholds.CodVeryHighThresholdDegrees != submittedThresholds.CodVeryHighThresholdDegrees ||
            existingProfile.MetricThresholds.CodMinimumSpeedMps != submittedThresholds.CodMinimumSpeedMps ||
            existingProfile.MetricThresholds.CodConsecutiveSamplesRequired != submittedThresholds.CodConsecutiveSamplesRequired;

        var normalizedThresholds = new MetricThresholdProfile
        {
            MaxSpeedMps = submittedThresholds.MaxSpeedMps,
            MaxSpeedMode = submittedThresholds.MaxSpeedMode,
            MaxHeartRateBpm = submittedThresholds.MaxHeartRateBpm,
            MaxHeartRateMode = submittedThresholds.MaxHeartRateMode,
            SprintSpeedPercentOfMaxSpeed = submittedThresholds.SprintSpeedPercentOfMaxSpeed,
            HighIntensitySpeedPercentOfMaxSpeed = submittedThresholds.HighIntensitySpeedPercentOfMaxSpeed,
            ModerateAccelerationThresholdMps2 = submittedThresholds.ModerateAccelerationThresholdMps2,
            HighAccelerationThresholdMps2 = submittedThresholds.HighAccelerationThresholdMps2,
            VeryHighAccelerationThresholdMps2 = submittedThresholds.VeryHighAccelerationThresholdMps2,
            ModerateDecelerationThresholdMps2 = submittedThresholds.ModerateDecelerationThresholdMps2,
            HighDecelerationThresholdMps2 = submittedThresholds.HighDecelerationThresholdMps2,
            VeryHighDecelerationThresholdMps2 = submittedThresholds.VeryHighDecelerationThresholdMps2,
            AccelDecelMinimumSpeedMps = submittedThresholds.AccelDecelMinimumSpeedMps,
            CodModerateThresholdDegrees = submittedThresholds.CodModerateThresholdDegrees,
            CodHighThresholdDegrees = submittedThresholds.CodHighThresholdDegrees,
            CodVeryHighThresholdDegrees = submittedThresholds.CodVeryHighThresholdDegrees,
            CodMinimumSpeedMps = submittedThresholds.CodMinimumSpeedMps,
            CodConsecutiveSamplesRequired = submittedThresholds.CodConsecutiveSamplesRequired,
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
                PreferredSpeedUnit = normalizedPreferredSpeedUnit,
                PreferredAggregationWindowMinutes = normalizedPreferredAggregationWindowMinutes,
                PreferredTheme = normalizedPreferredTheme,
                PreferredLocale = normalizedPreferredLocale
            },
            cancellationToken);

        var profileAffectingSettingsChanged = thresholdsChanged
            || !string.Equals(existingProfile.DefaultSmoothingFilter, normalizedDefaultSmoothingFilter, StringComparison.OrdinalIgnoreCase)
            || !string.Equals(existingProfile.PreferredSpeedUnit, normalizedPreferredSpeedUnit, StringComparison.OrdinalIgnoreCase)
            || existingProfile.PreferredAggregationWindowMinutes != normalizedPreferredAggregationWindowMinutes;

        if (profileAffectingSettingsChanged)
        {
            await _recalculationOrchestrator.EnqueueAsync(ProfileRecalculationTriggers.ProfileUpdated, normalizedThresholds.Version, cancellationToken);
        }

        var effectiveThresholds = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken: cancellationToken);
        profile.MetricThresholds = effectiveThresholds;
        return profile;
    }


    public async Task<ProfileRecalculationJob> TriggerFullRecalculationAsync(string trigger, CancellationToken cancellationToken)
    {
        var profile = await _repository.GetAsync(cancellationToken);
        return await _recalculationOrchestrator.EnqueueAsync(trigger, profile.MetricThresholds.Version, cancellationToken);
    }

    public Task<ProfileRecalculationJob?> GetLatestRecalculationJobAsync(CancellationToken cancellationToken)
        => _recalculationJobRepository.GetLatestAsync(cancellationToken);

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

    public static string? NormalizePreferredTheme(string? requestedTheme, string fallbackTheme)
    {
        if (string.IsNullOrWhiteSpace(requestedTheme))
        {
            return fallbackTheme;
        }

        return UiThemes.Supported.FirstOrDefault(theme =>
            string.Equals(theme, requestedTheme.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public static string? NormalizePreferredLocale(string? requestedLocale, string? fallbackLocale)
    {
        if (string.IsNullOrWhiteSpace(requestedLocale))
        {
            return fallbackLocale;
        }

        return UiLanguages.Supported.FirstOrDefault(locale =>
            string.Equals(locale, requestedLocale.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public static int? NormalizePreferredAggregationWindowMinutes(int? requestedWindow, int fallbackWindow)
    {
        if (!requestedWindow.HasValue)
        {
            return fallbackWindow;
        }

        return AggregationWindows.Supported.Contains(requestedWindow.Value)
            ? requestedWindow.Value
            : null;
    }

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
