using System.Threading.Channels;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.UseCases;

namespace FootballMetrics.Api.Services;

public class ProfileRecalculationBackgroundService : BackgroundService, IProfileRecalculationOrchestrator
{
    private readonly Channel<ProfileRecalculationJob> _channel = Channel.CreateUnbounded<ProfileRecalculationJob>();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ProfileRecalculationBackgroundService> _logger;

    public ProfileRecalculationBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ProfileRecalculationBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<ProfileRecalculationJob> EnqueueAsync(string trigger, int profileThresholdVersion, CancellationToken cancellationToken)
    {
        var job = new ProfileRecalculationJob
        {
            Id = Guid.NewGuid(),
            Trigger = trigger,
            Status = ProfileRecalculationStatuses.Running,
            RequestedAtUtc = DateTime.UtcNow,
            ProfileThresholdVersion = profileThresholdVersion,
            TotalSessions = 0,
            UpdatedSessions = 0,
            FailedSessions = 0
        };

        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IProfileRecalculationJobRepository>();
        await repository.AddAsync(job, cancellationToken);

        await _channel.Writer.WriteAsync(job, cancellationToken);
        return job;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in _channel.Reader.ReadAllAsync(stoppingToken))
        {
            await ProcessJobAsync(job, stoppingToken);
        }
    }

    private async Task ProcessJobAsync(ProfileRecalculationJob job, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var sessionUseCase = scope.ServiceProvider.GetRequiredService<ITcxSessionUseCase>();
        var jobRepository = scope.ServiceProvider.GetRequiredService<IProfileRecalculationJobRepository>();

        var total = 0;
        var updated = 0;
        var failed = 0;

        try
        {
            var sessions = await sessionUseCase.ListAsync(cancellationToken);
            total = sessions.Count;
            foreach (var session in sessions)
            {
                try
                {
                    var recalculated = await sessionUseCase.RecalculateWithCurrentProfileAsync(session.Id, cancellationToken);
                    if (recalculated is null)
                    {
                        failed++;
                        continue;
                    }

                    updated++;
                }
                catch (Exception ex)
                {
                    failed++;
                    _logger.LogError(ex, "Profile recalculation failed for session {SessionId}", session.Id);
                }
            }

            var status = failed > 0 ? ProfileRecalculationStatuses.Failed : ProfileRecalculationStatuses.Completed;
            var error = failed > 0 ? "One or more sessions failed during recalculation." : null;
            await jobRepository.UpdateOutcomeAsync(job.Id, status, total, updated, failed, error, DateTime.UtcNow, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Profile recalculation job {JobId} failed", job.Id);
            await jobRepository.UpdateOutcomeAsync(job.Id, ProfileRecalculationStatuses.Failed, total, updated, failed, ex.Message, DateTime.UtcNow, cancellationToken);
        }
    }
}
