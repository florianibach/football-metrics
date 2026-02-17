using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Repositories;

public interface ITcxUploadRepository
{
    Task<TcxUpload> AddAsync(TcxUpload upload, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default);
    Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
}
