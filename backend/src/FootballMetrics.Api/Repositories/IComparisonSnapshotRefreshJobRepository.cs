using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Repositories;

public interface IComparisonSnapshotRefreshJobRepository
{
    Task<ComparisonSnapshotRefreshJob> AddAsync(ComparisonSnapshotRefreshJob job, CancellationToken cancellationToken = default);
    Task<ComparisonSnapshotRefreshJob?> GetLatestAsync(CancellationToken cancellationToken = default);
    Task<bool> UpdateOutcomeAsync(Guid id, string status, int totalSessions, int updatedSessions, int failedSessions, string? errorMessage, DateTime completedAtUtc, CancellationToken cancellationToken = default);
}
