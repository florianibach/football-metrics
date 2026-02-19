namespace FootballMetrics.Api.Models;

public sealed record TcxDataAvailability(
    string Mode,
    string GpsStatus,
    string? GpsReason,
    string HeartRateStatus,
    string? HeartRateReason);
