using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public interface IMetricThresholdResolver
{
    Task<MetricThresholdProfile> ResolveEffectiveAsync(MetricThresholdProfile baseProfile, CancellationToken cancellationToken = default);
}
