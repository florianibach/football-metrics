namespace FootballMetrics.Api.Models;

public sealed record TcxSessionSegment(
    Guid Id,
    string Label,
    int StartSecond,
    int EndSecond,
    string Category,
    string? Notes);

public sealed record TcxSegmentChangeEntry(
    int Version,
    DateTime ChangedAtUtc,
    string Action,
    string? Notes,
    IReadOnlyList<TcxSessionSegment> SegmentsSnapshot);
