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
    string DistanceSource,
    string QualityStatus,
    IReadOnlyList<string> QualityReasons,
    TcxDataAvailability DataAvailability,
    IReadOnlyList<TcxGpsTrackpoint> GpsTrackpoints,
    TcxSmoothingTrace Smoothing,
    TcxFootballCoreMetrics CoreMetrics,
    IReadOnlyList<TcxIntervalAggregate> IntervalAggregates);

public sealed record TcxGpsTrackpoint(
    double Latitude,
    double Longitude,
    double? ElapsedSeconds);
