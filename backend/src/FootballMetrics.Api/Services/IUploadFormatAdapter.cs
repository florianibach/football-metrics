namespace FootballMetrics.Api.Services;

public interface IUploadFormatAdapter
{
    string FormatKey { get; }

    IReadOnlyCollection<string> SupportedExtensions { get; }

    Task<UploadParseResult> ParseAsync(byte[] rawFileBytes, CancellationToken cancellationToken);
}
