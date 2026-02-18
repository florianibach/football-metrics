using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Repositories;

public interface IUserProfileRepository
{
    Task<UserProfile> GetAsync(CancellationToken cancellationToken = default);
    Task<UserProfile> UpsertAsync(UserProfile profile, CancellationToken cancellationToken = default);
}
