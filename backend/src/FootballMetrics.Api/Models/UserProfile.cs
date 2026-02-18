namespace FootballMetrics.Api.Models;

public class UserProfile
{
    public string PrimaryPosition { get; set; } = PlayerPositions.CentralMidfielder;
    public string? SecondaryPosition { get; set; }
    public MetricThresholdProfile MetricThresholds { get; set; } = MetricThresholdProfile.CreateDefault();
}

public static class PlayerPositions
{
    public const string Goalkeeper = "Goalkeeper";
    public const string CentreBack = "CentreBack";
    public const string FullBack = "FullBack";
    public const string DefensiveMidfielder = "DefensiveMidfielder";
    public const string CentralMidfielder = "CentralMidfielder";
    public const string AttackingMidfielder = "AttackingMidfielder";
    public const string Winger = "Winger";
    public const string Striker = "Striker";

    public static readonly IReadOnlyList<string> Supported =
    [
        Goalkeeper,
        CentreBack,
        FullBack,
        DefensiveMidfielder,
        CentralMidfielder,
        AttackingMidfielder,
        Winger,
        Striker
    ];
}

public class MetricThresholdProfile
{
    public double SprintSpeedThresholdMps { get; set; } = 7.0;
    public double HighIntensitySpeedThresholdMps { get; set; } = 5.5;
    public double AccelerationThresholdMps2 { get; set; } = 2.0;
    public double DecelerationThresholdMps2 { get; set; } = -2.0;
    public int Version { get; set; } = 1;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public static MetricThresholdProfile CreateDefault()
        => new();

    public static string? Validate(MetricThresholdProfile profile)
    {
        if (profile.SprintSpeedThresholdMps < 4 || profile.SprintSpeedThresholdMps > 12)
        {
            return "SprintSpeedThresholdMps must be between 4.0 and 12.0.";
        }

        if (profile.HighIntensitySpeedThresholdMps < 3 || profile.HighIntensitySpeedThresholdMps > 10)
        {
            return "HighIntensitySpeedThresholdMps must be between 3.0 and 10.0.";
        }

        if (profile.HighIntensitySpeedThresholdMps >= profile.SprintSpeedThresholdMps)
        {
            return "HighIntensitySpeedThresholdMps must be lower than SprintSpeedThresholdMps.";
        }

        if (profile.AccelerationThresholdMps2 < 0.5 || profile.AccelerationThresholdMps2 > 6)
        {
            return "AccelerationThresholdMps2 must be between 0.5 and 6.0.";
        }

        if (profile.DecelerationThresholdMps2 > -0.5 || profile.DecelerationThresholdMps2 < -6)
        {
            return "DecelerationThresholdMps2 must be between -6.0 and -0.5.";
        }

        return null;
    }
}

public record UpdateUserProfileRequest(string PrimaryPosition, string? SecondaryPosition, MetricThresholdProfile? MetricThresholds);
public record UserProfileResponse(string PrimaryPosition, string? SecondaryPosition, MetricThresholdProfile MetricThresholds);
