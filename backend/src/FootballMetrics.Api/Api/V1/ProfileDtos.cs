using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Api.V1;

public record UpdateUserProfileRequestDto(string PrimaryPosition, string? SecondaryPosition, MetricThresholdProfile? MetricThresholds, string? DefaultSmoothingFilter, string? PreferredSpeedUnit);
public record UserProfileResponseDto(string PrimaryPosition, string? SecondaryPosition, MetricThresholdProfile MetricThresholds, string DefaultSmoothingFilter, string PreferredSpeedUnit);
