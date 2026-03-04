namespace FootballMetrics.Api.Models;

public class ComparisonSnapshotRefreshJob
{
    public Guid Id { get; set; }
    public string Status { get; set; } = ComparisonSnapshotRefreshStatuses.Running;
    public string Trigger { get; set; } = ComparisonSnapshotRefreshTriggers.SessionUpdated;
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int TotalSessions { get; set; }
    public int UpdatedSessions { get; set; }
    public int FailedSessions { get; set; }
    public string? ErrorMessage { get; set; }
}

public static class ComparisonSnapshotRefreshStatuses
{
    public const string Running = "Running";
    public const string Completed = "Completed";
    public const string Failed = "Failed";
}

public static class ComparisonSnapshotRefreshTriggers
{
    public const string UploadCreated = "UploadCreated";
    public const string SessionUpdated = "SessionUpdated";
    public const string SegmentUpdated = "SegmentUpdated";
    public const string SessionDeleted = "SessionDeleted";
    public const string ProfileComparisonCountUpdated = "ProfileComparisonCountUpdated";
}
