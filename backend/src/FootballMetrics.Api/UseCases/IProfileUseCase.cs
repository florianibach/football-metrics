using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.UseCases;

public interface IProfileUseCase
{
    Task<UserProfile> GetProfileAsync(CancellationToken cancellationToken);
    Task<UserProfile> UpdateProfileAsync(UpdateUserProfileRequest request, CancellationToken cancellationToken);
}
