using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public sealed record UploadParseResult(
    bool IsSuccess,
    string? ErrorMessage,
    TcxActivitySummary? Summary,
    CanonicalActivity? CanonicalActivity)
{
    public static UploadParseResult Success(TcxActivitySummary summary, CanonicalActivity canonicalActivity) =>
        new(true, null, summary, canonicalActivity);

    public static UploadParseResult Failure(string errorMessage) =>
        new(false, errorMessage, null, null);
}
