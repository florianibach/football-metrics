namespace FootballMetrics.Api.Models;

public sealed record TcxSessionSegment(
    Guid Id,
    string Label,
    int StartSecond,
    int EndSecond);

public sealed record TcxSegmentChangeEntry(
    int Version,
    DateTime ChangedAtUtc,
    string Action,
    string? Reason,
    IReadOnlyList<TcxSessionSegment> SegmentsSnapshot);
