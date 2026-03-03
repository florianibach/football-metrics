namespace FootballMetrics.Api.Models;

using System.Text.Json.Serialization;

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
    [property: JsonIgnore] int? AccelerationCount,
    [property: JsonIgnore] int? DecelerationCount,
    [property: JsonIgnore] int? ModerateAccelerationCount,
    [property: JsonIgnore] int? HighAccelerationCount,
    [property: JsonIgnore] int? VeryHighAccelerationCount,
    [property: JsonIgnore] int? ModerateDecelerationCount,
    [property: JsonIgnore] int? HighDecelerationCount,
    [property: JsonIgnore] int? VeryHighDecelerationCount,
    [property: JsonIgnore] int? DirectionChanges,
    [property: JsonIgnore] int? ModerateDirectionChangeCount,
    [property: JsonIgnore] int? HighDirectionChangeCount,
    [property: JsonIgnore] int? VeryHighDirectionChangeCount,
    double? HeartRateZoneLowSeconds,
    double? HeartRateZoneMediumSeconds,
    double? HeartRateZoneHighSeconds,
    double? TrainingImpulseEdwards,
    int? HeartRateRecoveryAfter60Seconds,
    IReadOnlyDictionary<string, TcxMetricAvailability> MetricAvailability,
    IReadOnlyDictionary<string, string> Thresholds);
