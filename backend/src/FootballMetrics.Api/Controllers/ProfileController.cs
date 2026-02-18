using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly IUserProfileRepository _repository;

    public ProfileController(IUserProfileRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<ActionResult<UserProfileResponse>> GetProfile(CancellationToken cancellationToken)
    {
        var profile = await _repository.GetAsync(cancellationToken);
        return Ok(new UserProfileResponse(profile.PrimaryPosition, profile.SecondaryPosition));
    }

    [HttpPut]
    public async Task<ActionResult<UserProfileResponse>> UpdateProfile([FromBody] UpdateUserProfileRequest request, CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return BadRequest("Profile payload is required.");
        }

        var normalizedPrimary = NormalizeRequired(request.PrimaryPosition);
        if (normalizedPrimary is null)
        {
            return BadRequest($"Unsupported primary position. Supported values: {string.Join(", ", PlayerPositions.Supported)}.");
        }

        var primaryPosition = NormalizeSupportedPosition(normalizedPrimary);
        if (primaryPosition is null)
        {
            return BadRequest($"Unsupported primary position. Supported values: {string.Join(", ", PlayerPositions.Supported)}.");
        }

        var normalizedSecondary = NormalizeOptional(request.SecondaryPosition);
        var secondaryPosition = normalizedSecondary is null ? null : NormalizeSupportedPosition(normalizedSecondary);
        if (normalizedSecondary is not null && secondaryPosition is null)
        {
            return BadRequest($"Unsupported secondary position. Supported values: {string.Join(", ", PlayerPositions.Supported)}.");
        }

        if (string.Equals(primaryPosition, secondaryPosition, StringComparison.Ordinal))
        {
            return BadRequest("Secondary position must differ from primary position.");
        }

        var profile = await _repository.UpsertAsync(
            new UserProfile
            {
                PrimaryPosition = primaryPosition,
                SecondaryPosition = secondaryPosition
            },
            cancellationToken);

        return Ok(new UserProfileResponse(profile.PrimaryPosition, profile.SecondaryPosition));
    }

    private static string? NormalizeSupportedPosition(string value)
        => PlayerPositions.Supported.FirstOrDefault(position => string.Equals(position, value, StringComparison.OrdinalIgnoreCase));

    private static string? NormalizeRequired(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
