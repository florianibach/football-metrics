namespace FootballMetrics.Api.Models;

public sealed record TcxFootballCoreMetrics(
    bool IsAvailable,
    string? UnavailableReason,
    double? DistanceMeters,
    double? SprintDistanceMeters,
    int? SprintCount,
    double? MaxSpeedMetersPerSecond,
    double? HighIntensityTimeSeconds,
    int? HighIntensityRunCount,
    double? HighSpeedDistanceMeters,
    double? RunningDensityMetersPerMinute,
    int? AccelerationCount,
    int? DecelerationCount,
    double? HeartRateZoneLowSeconds,
    double? HeartRateZoneMediumSeconds,
    double? HeartRateZoneHighSeconds,
    double? TrainingImpulseEdwards,
    int? HeartRateRecoveryAfter60Seconds,
    IReadOnlyDictionary<string, TcxMetricAvailability> MetricAvailability,
    IReadOnlyDictionary<string, string> Thresholds);
