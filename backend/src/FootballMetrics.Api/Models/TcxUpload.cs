namespace FootballMetrics.Api.Models;

public class TcxUpload
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredFilePath { get; set; } = string.Empty;
    public DateTime UploadedAtUtc { get; set; }
}
