using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Repositories;

public interface IProfileRecalculationJobRepository
{
    Task<ProfileRecalculationJob> AddAsync(ProfileRecalculationJob job, CancellationToken cancellationToken = default);
    Task<ProfileRecalculationJob?> GetLatestAsync(CancellationToken cancellationToken = default);
    Task<bool> UpdateOutcomeAsync(Guid id, string status, int totalSessions, int updatedSessions, int failedSessions, string? errorMessage, DateTime completedAtUtc, CancellationToken cancellationToken = default);
}
