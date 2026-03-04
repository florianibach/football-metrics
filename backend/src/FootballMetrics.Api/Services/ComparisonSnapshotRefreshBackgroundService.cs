using System.Threading.Channels;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.UseCases;

namespace FootballMetrics.Api.Services;

public class ComparisonSnapshotRefreshBackgroundService : BackgroundService, IComparisonSnapshotRefreshOrchestrator
{
    private readonly Channel<ComparisonSnapshotRefreshJob> _channel = Channel.CreateUnbounded<ComparisonSnapshotRefreshJob>();
    private readonly object _pendingLock = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ComparisonSnapshotRefreshBackgroundService> _logger;
    private bool _hasPendingFollowUpRefresh;
    private string _pendingFollowUpTrigger = ComparisonSnapshotRefreshTriggers.SessionUpdated;

    public ComparisonSnapshotRefreshBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ComparisonSnapshotRefreshBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<ComparisonSnapshotRefreshJob> EnqueueAsync(string trigger, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IComparisonSnapshotRefreshJobRepository>();
        var latest = await repository.GetLatestAsync(cancellationToken);
        if (latest is not null && latest.Status == ComparisonSnapshotRefreshStatuses.Running)
        {
            lock (_pendingLock)
            {
                _hasPendingFollowUpRefresh = true;
                _pendingFollowUpTrigger = trigger;
            }

            return latest;
        }

        var job = new ComparisonSnapshotRefreshJob
        {
            Id = Guid.NewGuid(),
            Trigger = trigger,
            Status = ComparisonSnapshotRefreshStatuses.Running,
            RequestedAtUtc = DateTime.UtcNow,
            TotalSessions = 0,
            UpdatedSessions = 0,
            FailedSessions = 0
        };

        await repository.AddAsync(job, cancellationToken);
        await _channel.Writer.WriteAsync(job, cancellationToken);
        return job;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in _channel.Reader.ReadAllAsync(stoppingToken))
        {
            await ProcessJobAsync(job, stoppingToken);
            await TryScheduleFollowUpRefreshAsync(stoppingToken);
        }
    }

    private async Task ProcessJobAsync(ComparisonSnapshotRefreshJob job, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var sessionUseCase = scope.ServiceProvider.GetRequiredService<ITcxSessionUseCase>();
        var repository = scope.ServiceProvider.GetRequiredService<IComparisonSnapshotRefreshJobRepository>();

        try
        {
            var sessions = await sessionUseCase.ListAsync(cancellationToken);
            var total = sessions.Count;
            await sessionUseCase.RefreshComparisonSnapshotsAsync(cancellationToken);
            await repository.UpdateOutcomeAsync(job.Id, ComparisonSnapshotRefreshStatuses.Completed, total, total, 0, null, DateTime.UtcNow, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Comparison snapshot refresh job {JobId} failed", job.Id);
            await repository.UpdateOutcomeAsync(job.Id, ComparisonSnapshotRefreshStatuses.Failed, 0, 0, 1, ex.Message, DateTime.UtcNow, cancellationToken);
        }
    }

    private async Task TryScheduleFollowUpRefreshAsync(CancellationToken cancellationToken)
    {
        string? trigger = null;
        lock (_pendingLock)
        {
            if (!_hasPendingFollowUpRefresh)
            {
                return;
            }

            trigger = _pendingFollowUpTrigger;
            _hasPendingFollowUpRefresh = false;
        }

        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IComparisonSnapshotRefreshJobRepository>();
        var latest = await repository.GetLatestAsync(cancellationToken);
        if (latest is not null && latest.Status == ComparisonSnapshotRefreshStatuses.Running)
        {
            lock (_pendingLock)
            {
                _hasPendingFollowUpRefresh = true;
                _pendingFollowUpTrigger = trigger;
            }

            return;
        }

        var followUpJob = new ComparisonSnapshotRefreshJob
        {
            Id = Guid.NewGuid(),
            Trigger = trigger,
            Status = ComparisonSnapshotRefreshStatuses.Running,
            RequestedAtUtc = DateTime.UtcNow,
            TotalSessions = 0,
            UpdatedSessions = 0,
            FailedSessions = 0
        };

        await repository.AddAsync(followUpJob, cancellationToken);
        await _channel.Writer.WriteAsync(followUpJob, cancellationToken);
    }
}
