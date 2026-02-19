using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public interface IProfileRecalculationOrchestrator
{
    Task<ProfileRecalculationJob> EnqueueAsync(string trigger, int profileThresholdVersion, CancellationToken cancellationToken);
}
