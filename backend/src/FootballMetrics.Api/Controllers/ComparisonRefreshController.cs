using FootballMetrics.Api.Api.V1;
using FootballMetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/v1/comparison-refresh")]
public class ComparisonRefreshController : ControllerBase
{
    private readonly IComparisonSnapshotRefreshJobRepository _repository;

    public ComparisonRefreshController(IComparisonSnapshotRefreshJobRepository repository)
    {
        _repository = repository;
    }

    [HttpGet("latest")]
    public async Task<ActionResult<ComparisonRefreshJobDto?>> GetLatest(CancellationToken cancellationToken)
    {
        var latest = await _repository.GetLatestAsync(cancellationToken);
        if (latest is null)
        {
            return Ok(null);
        }

        return Ok(new ComparisonRefreshJobDto(
            latest.Id,
            latest.Status,
            latest.Trigger,
            latest.RequestedAtUtc,
            latest.CompletedAtUtc,
            latest.TotalSessions,
            latest.UpdatedSessions,
            latest.FailedSessions,
            latest.ErrorMessage));
    }
}
