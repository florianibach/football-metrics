namespace FootballMetrics.Api.Models;

public sealed record CanonicalActivity(
    string SourceFormat,
    DateTime? ActivityStartTimeUtc,
    double? DurationSeconds,
    int TrackpointCount,
    bool HasGpsData,
    int? HeartRateMinBpm,
    int? HeartRateAverageBpm,
    int? HeartRateMaxBpm,
    double? DistanceMeters,
    string QualityStatus);
