namespace FootballMetrics.Api.Models;

public sealed record TcxFootballCoreMetrics(
    bool IsAvailable,
    string? UnavailableReason,
    double? DistanceMeters,
    double? SprintDistanceMeters,
    int? SprintCount,
    double? MaxSpeedMetersPerSecond,
    double? HighIntensityTimeSeconds,
    IReadOnlyDictionary<string, string> Thresholds);
