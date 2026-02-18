using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Repositories;

public interface ITcxUploadRepository
{
    Task<TcxUpload> AddAsync(TcxUpload upload, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default);
    Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> UpdateSessionContextAsync(Guid id, string sessionType, string? matchResult, string? competition, string? opponentName, string? opponentLogoUrl, CancellationToken cancellationToken = default);
    Task<bool> UpdateSelectedSmoothingFilterAsync(Guid id, string selectedSmoothingFilter, CancellationToken cancellationToken = default);
}
