namespace FootballMetrics.Api.Models;

public class TcxUpload
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public byte[] RawFileContent { get; set; } = Array.Empty<byte>();
    public string ContentHashSha256 { get; set; } = string.Empty;
    public string UploadStatus { get; set; } = TcxUploadStatuses.Succeeded;
    public string? FailureReason { get; set; }
    public DateTime UploadedAtUtc { get; set; }
}

public static class TcxUploadStatuses
{
    public const string Succeeded = "Succeeded";
    public const string Failed = "Failed";
}
