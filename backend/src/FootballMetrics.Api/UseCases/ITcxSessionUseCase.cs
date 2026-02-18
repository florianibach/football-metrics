using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.UseCases;

public interface ITcxSessionUseCase
{
    Task<TcxUpload> UploadTcxAsync(IFormFile file, CancellationToken cancellationToken);
    Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken);
    Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<TcxUpload?> UpdateSessionContextAsync(Guid id, string sessionType, string? matchResult, string? competition, string? opponentName, string? opponentLogoUrl, CancellationToken cancellationToken);
    Task<TcxUpload?> UpdateSessionSmoothingFilterAsync(Guid id, string smoothingFilter, CancellationToken cancellationToken);
    Task<TcxUpload?> UpdateSessionSpeedUnitAsync(Guid id, string speedUnit, CancellationToken cancellationToken);
    Task<TcxUpload?> RecalculateWithCurrentProfileAsync(Guid id, CancellationToken cancellationToken);
    TcxActivitySummary CreateSummaryFromRawContent(byte[] rawFileContent, string selectedSmoothingFilter, string? metricThresholdSnapshotJson);
    AppliedProfileSnapshot ResolveAppliedProfileSnapshot(TcxUpload upload);
    IReadOnlyList<SessionRecalculationEntry> ResolveRecalculationHistory(TcxUpload upload);
}
