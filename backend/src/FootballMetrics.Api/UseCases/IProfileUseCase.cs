using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.UseCases;

public interface IProfileUseCase
{
    Task<UserProfile> GetProfileAsync(CancellationToken cancellationToken);
    Task<UserProfile> UpdateProfileAsync(UpdateUserProfileRequest request, CancellationToken cancellationToken);
    Task<ProfileRecalculationJob> TriggerFullRecalculationAsync(string trigger, CancellationToken cancellationToken);
    Task<ProfileRecalculationJob?> GetLatestRecalculationJobAsync(CancellationToken cancellationToken);
}
