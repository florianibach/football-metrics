using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.UseCases;

public sealed record UploadTcxOutcome(TcxUpload Upload, bool IsCreated);

public sealed class IdempotencyConflictException : Exception
{
    public IdempotencyConflictException(string message) : base(message)
    {
    }
}
