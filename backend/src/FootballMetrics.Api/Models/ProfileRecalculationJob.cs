namespace FootballMetrics.Api.Models;

public class ProfileRecalculationJob
{
    public Guid Id { get; set; }
    public string Status { get; set; } = ProfileRecalculationStatuses.Running;
    public string Trigger { get; set; } = ProfileRecalculationTriggers.ProfileUpdated;
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int ProfileThresholdVersion { get; set; }
    public int TotalSessions { get; set; }
    public int UpdatedSessions { get; set; }
    public int FailedSessions { get; set; }
    public string? ErrorMessage { get; set; }
}

public static class ProfileRecalculationStatuses
{
    public const string Running = "Running";
    public const string Completed = "Completed";
    public const string Failed = "Failed";

    public static readonly IReadOnlyList<string> Supported = [Running, Completed, Failed];
}

public static class ProfileRecalculationTriggers
{
    public const string ProfileUpdated = "ProfileUpdated";
    public const string Manual = "Manual";
}
