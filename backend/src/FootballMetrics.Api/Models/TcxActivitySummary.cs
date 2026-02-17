namespace FootballMetrics.Api.Models;

public sealed record TcxActivitySummary(
    DateTime? ActivityStartTimeUtc,
    double? DurationSeconds,
    int TrackpointCount,
    int? HeartRateMinBpm,
    int? HeartRateAverageBpm,
    int? HeartRateMaxBpm,
    double? DistanceMeters,
    bool HasGpsData,
    double? FileDistanceMeters,
    string DistanceSource);
