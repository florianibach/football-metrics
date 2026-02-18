using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Api.V1;

public record TcxUploadResponseDto(Guid Id, string FileName, DateTime UploadedAtUtc, TcxActivitySummary Summary, SessionContextResponseDto SessionContext, string SelectedSmoothingFilterSource, string SelectedSpeedUnitSource, string SelectedSpeedUnit, AppliedProfileSnapshot AppliedProfileSnapshot, IReadOnlyList<SessionRecalculationEntry> RecalculationHistory);
public record SessionContextResponseDto(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);
public record UpdateSmoothingFilterRequestDto(string Filter);
public record UpdateSpeedUnitRequestDto(string SpeedUnit);
public record UpdateSessionContextRequestDto(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);
