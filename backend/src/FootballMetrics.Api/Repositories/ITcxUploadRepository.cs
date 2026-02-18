using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Repositories;

public interface ITcxUploadRepository
{
    Task<TcxUpload> AddAsync(TcxUpload upload, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default);
    Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> UpdateSessionContextAsync(Guid id, string sessionType, string? matchResult, string? competition, string? opponentName, string? opponentLogoUrl, CancellationToken cancellationToken = default);
    Task<bool> UpdateSelectedSmoothingFilterAsync(Guid id, string selectedSmoothingFilter, CancellationToken cancellationToken = default);
    Task<bool> UpdateSelectedSmoothingFilterSourceAsync(Guid id, string selectedSmoothingFilterSource, CancellationToken cancellationToken = default);
    Task<bool> UpdateSelectedSpeedUnitAsync(Guid id, string selectedSpeedUnit, CancellationToken cancellationToken = default);
    Task<bool> UpdateSelectedSpeedUnitSourceAsync(Guid id, string selectedSpeedUnitSource, CancellationToken cancellationToken = default);
    Task<bool> UpdateProfileSnapshotsAsync(Guid id, string metricThresholdSnapshotJson, string appliedProfileSnapshotJson, string recalculationHistoryJson, CancellationToken cancellationToken = default);
    Task<bool> RecalculateSessionWithProfileAsync(
        Guid id,
        string selectedSmoothingFilter,
        string selectedSmoothingFilterSource,
        string selectedSpeedUnit,
        string selectedSpeedUnitSource,
        string metricThresholdSnapshotJson,
        string appliedProfileSnapshotJson,
        string recalculationHistoryJson,
        CancellationToken cancellationToken = default);
}
