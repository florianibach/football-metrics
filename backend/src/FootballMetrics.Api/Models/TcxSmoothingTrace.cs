namespace FootballMetrics.Api.Models;

public sealed record TcxSmoothingTrace(
    string SelectedStrategy,
    IReadOnlyDictionary<string, string> SelectedParameters,
    double? RawDistanceMeters,
    double? SmoothedDistanceMeters,
    int RawDirectionChanges,
    int BaselineDirectionChanges,
    int SmoothedDirectionChanges,
    int CorrectedOutlierCount,
    DateTime AnalyzedAtUtc);
