namespace FootballMetrics.Api.Models;

public sealed record TcxDataAvailability(
    string Mode,
    string GpsStatus,
    string? GpsReason,
    string HeartRateStatus,
    string? HeartRateReason,
    string? GpsQualityStatus = null,
    IReadOnlyList<string>? GpsQualityReasons = null,
    string? HeartRateQualityStatus = null,
    IReadOnlyList<string>? HeartRateQualityReasons = null);
