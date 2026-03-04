using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Api.V1;

public record TcxUploadResponseDto(Guid Id, string FileName, DateTime UploadedAtUtc, TcxActivitySummary Summary, SessionContextResponseDto SessionContext, string SelectedSmoothingFilterSource, string SelectedSpeedUnitSource, string SelectedSpeedUnit, AppliedProfileSnapshot AppliedProfileSnapshot, IReadOnlyList<SessionRecalculationEntry> RecalculationHistory, IReadOnlyList<TcxSessionSegment> Segments, IReadOnlyList<TcxSegmentChangeEntry> SegmentChangeHistory, bool IsDetailed, SessionComparisonContextDto? ComparisonContext = null);
public record SessionContextResponseDto(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);
public record UpdateSmoothingFilterRequestDto(string Filter);
public record UpdateSpeedUnitRequestDto(string SpeedUnit);
public record UpdateSessionContextRequestDto(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);

public record CreateSegmentRequestDto(string Label, int StartSecond, int EndSecond, string? Notes, string? Category);
public record UpdateSegmentRequestDto(string? Label, int? StartSecond, int? EndSecond, string? Notes, string? Category);
public record MergeSegmentsRequestDto(Guid SourceSegmentId, Guid TargetSegmentId, string? Label, string? Notes);
public record SplitSegmentRequestDto(Guid SegmentId, int SplitSecond, string? LeftLabel, string? RightLabel, string? Notes);

public record SessionComparisonContextDto(
    int ComparisonSessionsCount,
    string SessionType,
    IReadOnlyDictionary<string, ComparisonMetricDto> Overview,
    IReadOnlyDictionary<string, IReadOnlyDictionary<int, ComparisonMetricDto>> Peak,
    IReadOnlyDictionary<string, IReadOnlyDictionary<string, ComparisonMetricDto>> SegmentOverviewByCategory,
    IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyDictionary<int, ComparisonMetricDto>>> SegmentPeakByCategory);

public record ComparisonMetricDto(double? AverageLastN, double? Best, bool IsAvailable, string? AvailabilityReason);
