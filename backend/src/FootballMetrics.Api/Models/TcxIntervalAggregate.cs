namespace FootballMetrics.Api.Models;

public sealed record TcxIntervalAggregate(
    int WindowMinutes,
    int WindowIndex,
    DateTime WindowStartUtc,
    double WindowDurationSeconds,
    TcxFootballCoreMetrics CoreMetrics);
