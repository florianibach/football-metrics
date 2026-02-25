using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public interface IMetricThresholdResolver
{
    Task<MetricThresholdProfile> ResolveEffectiveAsync(
        MetricThresholdProfile baseProfile,
        double? candidateMaxSpeedMps = null,
        int? candidateMaxHeartRateBpm = null,
        CancellationToken cancellationToken = default);
}
