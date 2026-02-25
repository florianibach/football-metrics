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
    IReadOnlyList<TcxHeartRateSample> HeartRateSamples,
    TcxSmoothingTrace Smoothing,
    TcxFootballCoreMetrics CoreMetrics,
    IReadOnlyList<TcxIntervalAggregate> IntervalAggregates,
    IReadOnlyList<TcxDetectedRun> DetectedRuns);

public sealed record TcxGpsTrackpoint(
    double Latitude,
    double Longitude,
    double? ElapsedSeconds,
    int? HeartRateBpm);


public sealed record TcxDetectedRun(
    string RunId,
    string RunType,
    double StartElapsedSeconds,
    double DurationSeconds,
    double DistanceMeters,
    double TopSpeedMetersPerSecond,
    IReadOnlyList<int> PointIndices,
    string? ParentRunId,
    IReadOnlyList<TcxSprintPhase> SprintPhases);

public sealed record TcxSprintPhase(
    string RunId,
    double StartElapsedSeconds,
    double DurationSeconds,
    double DistanceMeters,
    double TopSpeedMetersPerSecond,
    IReadOnlyList<int> PointIndices,
    string ParentRunId);


public sealed record TcxHeartRateSample(
    double ElapsedSeconds,
    int HeartRateBpm);
