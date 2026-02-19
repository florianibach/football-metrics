using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Api.V1;

public record TcxUploadResponseDto(Guid Id, string FileName, DateTime UploadedAtUtc, TcxActivitySummary Summary, SessionContextResponseDto SessionContext, string SelectedSmoothingFilterSource, string SelectedSpeedUnitSource, string SelectedSpeedUnit, AppliedProfileSnapshot AppliedProfileSnapshot, IReadOnlyList<SessionRecalculationEntry> RecalculationHistory, IReadOnlyList<TcxSessionSegment> Segments, IReadOnlyList<TcxSegmentChangeEntry> SegmentChangeHistory);
public record SessionContextResponseDto(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);
public record UpdateSmoothingFilterRequestDto(string Filter);
public record UpdateSpeedUnitRequestDto(string SpeedUnit);
public record UpdateSessionContextRequestDto(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);

public record CreateSegmentRequestDto(string Label, int StartSecond, int EndSecond, string? Reason);
public record UpdateSegmentRequestDto(string? Label, int? StartSecond, int? EndSecond, string? Reason);
public record MergeSegmentsRequestDto(Guid SourceSegmentId, Guid TargetSegmentId, string? Label, string? Reason);
