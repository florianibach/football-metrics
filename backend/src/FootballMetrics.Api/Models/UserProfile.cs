namespace FootballMetrics.Api.Models;

public class UserProfile
{
    public string PrimaryPosition { get; set; } = PlayerPositions.CentralMidfielder;
    public string? SecondaryPosition { get; set; }
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

public record UpdateUserProfileRequest(string PrimaryPosition, string? SecondaryPosition);
public record UserProfileResponse(string PrimaryPosition, string? SecondaryPosition);
