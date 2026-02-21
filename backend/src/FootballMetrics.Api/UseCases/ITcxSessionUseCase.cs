using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.UseCases;

public interface ITcxSessionUseCase
{
    Task<UploadTcxOutcome> UploadTcxAsync(IFormFile file, string? idempotencyKey, CancellationToken cancellationToken);
    Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken);
    Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<TcxUpload?> UpdateSessionContextAsync(Guid id, string sessionType, string? matchResult, string? competition, string? opponentName, string? opponentLogoUrl, CancellationToken cancellationToken);
    Task<TcxUpload?> UpdateSessionSmoothingFilterAsync(Guid id, string smoothingFilter, CancellationToken cancellationToken);
    Task<TcxUpload?> UpdateSessionSpeedUnitAsync(Guid id, string speedUnit, CancellationToken cancellationToken);
    Task<TcxUpload?> RecalculateWithCurrentProfileAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> DeleteSessionAsync(Guid id, CancellationToken cancellationToken);
    Task<TcxUpload?> AddSegmentAsync(Guid id, string label, int startSecond, int endSecond, string? notes, string? category, CancellationToken cancellationToken);
    Task<TcxUpload?> UpdateSegmentAsync(Guid id, Guid segmentId, string? label, int? startSecond, int? endSecond, string? notes, string? category, CancellationToken cancellationToken);
    Task<TcxUpload?> DeleteSegmentAsync(Guid id, Guid segmentId, string? notes, CancellationToken cancellationToken);
    Task<TcxUpload?> MergeSegmentsAsync(Guid id, Guid sourceSegmentId, Guid targetSegmentId, string? label, string? notes, CancellationToken cancellationToken);
    Task<TcxUpload?> SplitSegmentAsync(Guid id, Guid segmentId, int splitSecond, string? leftLabel, string? rightLabel, string? notes, CancellationToken cancellationToken);
    TcxActivitySummary CreateSummaryFromRawContent(byte[] rawFileContent, string selectedSmoothingFilter, string? metricThresholdSnapshotJson);
    TcxActivitySummary ResolveSummary(TcxUpload upload);
    AppliedProfileSnapshot ResolveAppliedProfileSnapshot(TcxUpload upload);
    IReadOnlyList<SessionRecalculationEntry> ResolveRecalculationHistory(TcxUpload upload);
    IReadOnlyList<TcxSessionSegment> ResolveSegments(TcxUpload upload);
    IReadOnlyList<TcxSegmentChangeEntry> ResolveSegmentChangeHistory(TcxUpload upload);
}
