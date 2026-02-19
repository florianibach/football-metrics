using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Api.V1;

public record UpdateUserProfileRequestDto(string PrimaryPosition, string? SecondaryPosition, MetricThresholdProfile? MetricThresholds, string? DefaultSmoothingFilter, string? PreferredSpeedUnit, int? PreferredAggregationWindowMinutes);
public record UserProfileResponseDto(string PrimaryPosition, string? SecondaryPosition, MetricThresholdProfile MetricThresholds, string DefaultSmoothingFilter, string PreferredSpeedUnit, int PreferredAggregationWindowMinutes, ProfileRecalculationJobDto? LatestRecalculationJob);
public record ProfileRecalculationJobDto(Guid Id, string Status, string Trigger, DateTime RequestedAtUtc, DateTime? CompletedAtUtc, int ProfileThresholdVersion, int TotalSessions, int UpdatedSessions, int FailedSessions, string? ErrorMessage);
