using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public interface IComparisonSnapshotRefreshOrchestrator
{
    Task<ComparisonSnapshotRefreshJob> EnqueueAsync(string trigger, CancellationToken cancellationToken);
}
