namespace FootballMetrics.Api.Models;

public class UserProfile
{
    public string PrimaryPosition { get; set; } = PlayerPositions.CentralMidfielder;
    public string? SecondaryPosition { get; set; }
    public MetricThresholdProfile MetricThresholds { get; set; } = MetricThresholdProfile.CreateDefault();
    public string DefaultSmoothingFilter { get; set; } = TcxSmoothingFilters.AdaptiveMedian;
    public string PreferredSpeedUnit { get; set; } = SpeedUnits.KilometersPerHour;
    public int PreferredAggregationWindowMinutes { get; set; } = AggregationWindows.FiveMinutes;
    public string PreferredTheme { get; set; } = UiThemes.Dark;
    public string? PreferredLocale { get; set; }
}

public static class UiLanguages
{
    public const string English = "en";
    public const string German = "de";

    public static readonly IReadOnlyList<string> Supported =
    [
        English,
        German
    ];
}

public static class UiThemes
{
    public const string Light = "light";
    public const string Dark = "dark";

    public static readonly IReadOnlyList<string> Supported =
    [
        Light,
        Dark
    ];
}

public static class AggregationWindows
{
    public const int OneMinute = 1;
    public const int TwoMinutes = 2;
    public const int FiveMinutes = 5;

    public static readonly IReadOnlyList<int> Supported =
    [
        OneMinute,
        TwoMinutes,
        FiveMinutes
    ];
}

public static class SpeedUnits
{
    public const string KilometersPerHour = "km/h";
    public const string MilesPerHour = "mph";
    public const string MetersPerSecond = "m/s";
    public const string MinutesPerKilometer = "min/km";

    public static readonly IReadOnlyList<string> Supported =
    [
        KilometersPerHour,
        MilesPerHour,
        MetersPerSecond,
        MinutesPerKilometer
    ];
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
    // Absolute profile values (only these can be adaptive)
    public double MaxSpeedMps { get; set; } = 8.0;
    public string MaxSpeedMode { get; set; } = MetricThresholdModes.Adaptive;
    public int MaxHeartRateBpm { get; set; } = 190;
    public string MaxHeartRateMode { get; set; } = MetricThresholdModes.Adaptive;

    // Relative speed thresholds (always fixed percentages of max speed)
    public double SprintSpeedPercentOfMaxSpeed { get; set; } = 90;
    public double HighIntensitySpeedPercentOfMaxSpeed { get; set; } = 70;

    // Band-based thresholds
    public double ModerateAccelerationThresholdMps2 { get; set; } = 1.0;
    public double HighAccelerationThresholdMps2 { get; set; } = 1.8;
    public double VeryHighAccelerationThresholdMps2 { get; set; } = 2.5;
    public double ModerateDecelerationThresholdMps2 { get; set; } = -1.0;
    public double HighDecelerationThresholdMps2 { get; set; } = -1.8;
    public double VeryHighDecelerationThresholdMps2 { get; set; } = -2.5;
    public double AccelDecelMinimumSpeedMps { get; set; } = 10.0 / 3.6;

    // Effective readonly values for UI transparency in adaptive mode
    public double EffectiveMaxSpeedMps { get; set; } = 8.0;
    public int EffectiveMaxHeartRateBpm { get; set; } = 190;

    public int Version { get; set; } = 1;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public static MetricThresholdProfile CreateDefault()
        => new();

    public static string? Validate(MetricThresholdProfile profile)
    {
        if (!MetricThresholdModes.Supported.Contains(profile.MaxSpeedMode, StringComparer.OrdinalIgnoreCase))
        {
            return $"MaxSpeedMode must be one of: {string.Join(", ", MetricThresholdModes.Supported)}.";
        }

        if (!MetricThresholdModes.Supported.Contains(profile.MaxHeartRateMode, StringComparer.OrdinalIgnoreCase))
        {
            return $"MaxHeartRateMode must be one of: {string.Join(", ", MetricThresholdModes.Supported)}.";
        }

        if (profile.MaxSpeedMps < 4 || profile.MaxSpeedMps > 12)
        {
            return "MaxSpeedMps must be between 4.0 and 12.0.";
        }

        if (profile.MaxHeartRateBpm < 120 || profile.MaxHeartRateBpm > 240)
        {
            return "MaxHeartRateBpm must be between 120 and 240.";
        }

        if (profile.SprintSpeedPercentOfMaxSpeed < 70 || profile.SprintSpeedPercentOfMaxSpeed > 100)
        {
            return "SprintSpeedPercentOfMaxSpeed must be between 70 and 100.";
        }

        if (profile.HighIntensitySpeedPercentOfMaxSpeed < 40 || profile.HighIntensitySpeedPercentOfMaxSpeed > 95)
        {
            return "HighIntensitySpeedPercentOfMaxSpeed must be between 40 and 95.";
        }

        if (profile.HighIntensitySpeedPercentOfMaxSpeed >= profile.SprintSpeedPercentOfMaxSpeed)
        {
            return "HighIntensitySpeedPercentOfMaxSpeed must be lower than SprintSpeedPercentOfMaxSpeed.";
        }

        if (profile.ModerateAccelerationThresholdMps2 <= 0 || profile.HighAccelerationThresholdMps2 <= 0 || profile.VeryHighAccelerationThresholdMps2 <= 0)
        {
            return "Acceleration band thresholds must be positive values.";
        }

        if (!(profile.ModerateAccelerationThresholdMps2 <= profile.HighAccelerationThresholdMps2 &&
              profile.HighAccelerationThresholdMps2 <= profile.VeryHighAccelerationThresholdMps2))
        {
            return "Acceleration bands must satisfy Moderate <= High <= Very High.";
        }

        if (profile.ModerateDecelerationThresholdMps2 >= 0 || profile.HighDecelerationThresholdMps2 >= 0 || profile.VeryHighDecelerationThresholdMps2 >= 0)
        {
            return "Deceleration band thresholds must be negative values.";
        }

        if (!(profile.ModerateDecelerationThresholdMps2 >= profile.HighDecelerationThresholdMps2 &&
              profile.HighDecelerationThresholdMps2 >= profile.VeryHighDecelerationThresholdMps2))
        {
            return "Deceleration bands must satisfy Moderate >= High >= Very High.";
        }

        if (profile.AccelDecelMinimumSpeedMps < 0.5 || profile.AccelDecelMinimumSpeedMps > 12.0)
        {
            return "AccelDecelMinimumSpeedMps must be between 0.5 and 12.0.";
        }

        return null;
    }
}

public static class MetricThresholdModes
{
    public const string Fixed = "Fixed";
    public const string Adaptive = "Adaptive";

    public static readonly IReadOnlyList<string> Supported = [Fixed, Adaptive];
}

public record UpdateUserProfileRequest(string PrimaryPosition, string? SecondaryPosition, MetricThresholdProfile? MetricThresholds, string? DefaultSmoothingFilter, string? PreferredSpeedUnit, int? PreferredAggregationWindowMinutes, string? PreferredTheme = null, string? PreferredLocale = null);
public record UserProfileResponse(string PrimaryPosition, string? SecondaryPosition, MetricThresholdProfile MetricThresholds, string DefaultSmoothingFilter, string PreferredSpeedUnit, int PreferredAggregationWindowMinutes, string PreferredTheme, string? PreferredLocale = null);
