using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;

namespace FootballMetrics.Api.Services;

public class MetricThresholdResolver : IMetricThresholdResolver
{
    private readonly ITcxUploadRepository _repository;

    public MetricThresholdResolver(ITcxUploadRepository repository)
    {
        _repository = repository;
    }

    public async Task<MetricThresholdProfile> ResolveEffectiveAsync(
        MetricThresholdProfile baseProfile,
        double? candidateMaxSpeedMps = null,
        int? candidateMaxHeartRateBpm = null,
        CancellationToken cancellationToken = default)
    {
        var stats = await _repository.GetAdaptiveStatsExtremesAsync(cancellationToken);

        var effectiveAdaptiveMaxSpeed = stats.MaxSpeedMps;
        if (candidateMaxSpeedMps.HasValue)
        {
            effectiveAdaptiveMaxSpeed = !effectiveAdaptiveMaxSpeed.HasValue
                ? candidateMaxSpeedMps.Value
                : Math.Max(effectiveAdaptiveMaxSpeed.Value, candidateMaxSpeedMps.Value);
        }

        var effectiveAdaptiveMaxHeartRate = stats.MaxHeartRateBpm;
        if (candidateMaxHeartRateBpm.HasValue)
        {
            effectiveAdaptiveMaxHeartRate = !effectiveAdaptiveMaxHeartRate.HasValue
                ? candidateMaxHeartRateBpm.Value
                : Math.Max(effectiveAdaptiveMaxHeartRate.Value, candidateMaxHeartRateBpm.Value);
        }

        var effectiveMaxSpeed = string.Equals(baseProfile.MaxSpeedMode, MetricThresholdModes.Adaptive, StringComparison.OrdinalIgnoreCase) && effectiveAdaptiveMaxSpeed.HasValue
            ? effectiveAdaptiveMaxSpeed.Value
            : baseProfile.MaxSpeedMps;

        var effectiveMaxHeartRate = string.Equals(baseProfile.MaxHeartRateMode, MetricThresholdModes.Adaptive, StringComparison.OrdinalIgnoreCase) && effectiveAdaptiveMaxHeartRate.HasValue
            ? effectiveAdaptiveMaxHeartRate.Value
            : baseProfile.MaxHeartRateBpm;

        return new MetricThresholdProfile
        {
            MaxSpeedMps = Math.Clamp(Math.Round(baseProfile.MaxSpeedMps, 2), 4.0, 12.0),
            MaxSpeedMode = NormalizeMode(baseProfile.MaxSpeedMode),
            MaxHeartRateBpm = Math.Clamp(baseProfile.MaxHeartRateBpm, 120, 240),
            MaxHeartRateMode = NormalizeMode(baseProfile.MaxHeartRateMode),
            SprintSpeedPercentOfMaxSpeed = Math.Clamp(Math.Round(baseProfile.SprintSpeedPercentOfMaxSpeed, 1), 70, 100),
            HighIntensitySpeedPercentOfMaxSpeed = Math.Clamp(Math.Round(baseProfile.HighIntensitySpeedPercentOfMaxSpeed, 1), 40, 95),
            ModerateAccelerationThresholdMps2 = Math.Clamp(Math.Round(baseProfile.ModerateAccelerationThresholdMps2, 2), 0.5, 6.0),
            HighAccelerationThresholdMps2 = Math.Clamp(Math.Round(baseProfile.HighAccelerationThresholdMps2, 2), 0.5, 6.0),
            VeryHighAccelerationThresholdMps2 = Math.Clamp(Math.Round(baseProfile.VeryHighAccelerationThresholdMps2, 2), 0.5, 6.0),
            ModerateDecelerationThresholdMps2 = Math.Clamp(Math.Round(baseProfile.ModerateDecelerationThresholdMps2, 2), -6.0, -0.5),
            HighDecelerationThresholdMps2 = Math.Clamp(Math.Round(baseProfile.HighDecelerationThresholdMps2, 2), -6.0, -0.5),
            VeryHighDecelerationThresholdMps2 = Math.Clamp(Math.Round(baseProfile.VeryHighDecelerationThresholdMps2, 2), -6.0, -0.5),
            AccelDecelMinimumSpeedMps = Math.Clamp(Math.Round(baseProfile.AccelDecelMinimumSpeedMps, 2), 0.5, 12.0),
            CodModerateThresholdDegrees = Math.Clamp(Math.Round(baseProfile.CodModerateThresholdDegrees, 1), 10, 170),
            CodHighThresholdDegrees = Math.Clamp(Math.Round(baseProfile.CodHighThresholdDegrees, 1), 10, 170),
            CodVeryHighThresholdDegrees = Math.Clamp(Math.Round(baseProfile.CodVeryHighThresholdDegrees, 1), 10, 180),
            CodMinimumSpeedMps = Math.Clamp(Math.Round(baseProfile.CodMinimumSpeedMps, 2), 0.5, 12.0),
            CodConsecutiveSamplesRequired = Math.Clamp(baseProfile.CodConsecutiveSamplesRequired, 1, 5),
            EffectiveMaxSpeedMps = Math.Clamp(Math.Round(effectiveMaxSpeed, 2), 4.0, 12.0),
            EffectiveMaxHeartRateBpm = Math.Clamp(effectiveMaxHeartRate, 120, 240),
            Version = baseProfile.Version,
            UpdatedAtUtc = baseProfile.UpdatedAtUtc
        };
    }

    private static string NormalizeMode(string? value)
        => MetricThresholdModes.Supported.FirstOrDefault(mode => string.Equals(mode, value, StringComparison.OrdinalIgnoreCase))
           ?? MetricThresholdModes.Fixed;

}
