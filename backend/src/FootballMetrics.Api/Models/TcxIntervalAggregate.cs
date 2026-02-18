namespace FootballMetrics.Api.Models;

public sealed record TcxIntervalAggregate(
    int WindowMinutes,
    int WindowIndex,
    DateTime WindowStartUtc,
    DateTime WindowEndUtc,
    double CoveredSeconds,
    double MissingSeconds,
    bool HasMissingData,
    TcxFootballCoreMetrics CoreMetrics);
