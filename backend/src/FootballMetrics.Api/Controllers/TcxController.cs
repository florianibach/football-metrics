using FootballMetrics.Api.Api;
using FootballMetrics.Api.Api.V1;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Services;
using FootballMetrics.Api.UseCases;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TcxController : ControllerBase
{
    private const long MaxFileSizeInBytes = 20 * 1024 * 1024;
    private readonly ITcxSessionUseCase _tcxSessionUseCase;
    private readonly IUploadFormatAdapterResolver _uploadFormatAdapterResolver;
    private readonly ILogger<TcxController> _logger;

    public TcxController(ITcxSessionUseCase tcxSessionUseCase, IUploadFormatAdapterResolver uploadFormatAdapterResolver, ILogger<TcxController> logger)
    {
        _tcxSessionUseCase = tcxSessionUseCase;
        _uploadFormatAdapterResolver = uploadFormatAdapterResolver;
        _logger = logger;
    }

    [HttpPost("upload")]
    [EnableRateLimiting("upload")]
    [RequestSizeLimit(MaxFileSizeInBytes)]
    public async Task<ActionResult<TcxUploadResponseDto>> UploadTcx(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid upload request", "No file uploaded. Please select a .tcx file and try again.", ApiErrorCodes.ValidationError);
        }

        var adapter = _uploadFormatAdapterResolver.ResolveByFileName(file.FileName);
        if (adapter is null)
        {
            var fileExtension = Path.GetExtension(file.FileName);
            var normalizedExtension = string.IsNullOrWhiteSpace(fileExtension) ? "<none>" : fileExtension;
            var supportedExtensions = string.Join(", ", _uploadFormatAdapterResolver.GetSupportedExtensions());

            _logger.LogInformation("Rejected unsupported upload extension {FileExtension}. File {FileName} can be considered for a future adapter.", normalizedExtension, file.FileName);

            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Unsupported file type", $"File type '{normalizedExtension}' is currently not supported. Supported formats: {supportedExtensions}. The format has been logged for potential future support.", ApiErrorCodes.UnsupportedFileType);
        }

        if (file.Length > MaxFileSizeInBytes)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid upload request", $"File is too large. Maximum supported size is {MaxFileSizeInBytes / (1024 * 1024)} MB.", ApiErrorCodes.ValidationError);
        }

        try
        {
            var idempotencyKey = HttpContext?.Request?.Headers["Idempotency-Key"].FirstOrDefault();
            var outcome = await _tcxSessionUseCase.UploadTcxAsync(file, idempotencyKey, cancellationToken);
            if (outcome.IsCreated)
            {
                return CreatedAtAction(nameof(GetUpload), new { id = outcome.Upload.Id }, ToResponse(outcome.Upload));
            }

            return Ok(ToResponse(outcome.Upload));
        }
        catch (InvalidDataException ex)
        {
            _logger.LogInformation(ex, "Unable to parse upload {FileName}", file.FileName);
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Unable to parse upload", ex.Message, ApiErrorCodes.UploadParseFailed);
        }
        catch (IdempotencyConflictException ex)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status409Conflict, "Idempotency conflict", ex.Message, ApiErrorCodes.IdempotencyConflict);
        }
        catch
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status500InternalServerError, "Upload processing failed", "The upload could not be persisted.", ApiErrorCodes.UploadStorageFailed);
        }
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TcxUploadResponseDto>>> GetUploads(CancellationToken cancellationToken)
    {
        var uploads = await _tcxSessionUseCase.ListAsync(cancellationToken);
        return Ok(uploads.Select(ToResponse).ToList());
    }


    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteUpload(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await _tcxSessionUseCase.DeleteSessionAsync(id, cancellationToken);
        if (!deleted)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Session not found", "The requested session does not exist.", ApiErrorCodes.ResourceNotFound);
        }

        return NoContent();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TcxUploadResponseDto>> GetUpload(Guid id, CancellationToken cancellationToken)
    {
        var upload = await _tcxSessionUseCase.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Session not found", "The requested session does not exist.", ApiErrorCodes.ResourceNotFound);
        }

        return Ok(ToResponse(upload));
    }

    [HttpPut("{id:guid}/session-context")]
    public async Task<ActionResult<TcxUploadResponseDto>> UpdateSessionContext(Guid id, [FromBody] UpdateSessionContextRequestDto request, CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.SessionType) || !TcxSessionTypes.Supported.Contains(request.SessionType))
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid session context", $"Unsupported session type. Supported values: {string.Join(", ", TcxSessionTypes.Supported)}.", ApiErrorCodes.ValidationError);
        }

        var opponentLogoUrl = NormalizeOptional(request.OpponentLogoUrl);
        if (!string.IsNullOrWhiteSpace(opponentLogoUrl) && !Uri.TryCreate(opponentLogoUrl, UriKind.Absolute, out _))
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid session context", "OpponentLogoUrl must be an absolute URL.", ApiErrorCodes.ValidationError);
        }

        var upload = await _tcxSessionUseCase.UpdateSessionContextAsync(
            id,
            request.SessionType,
            NormalizeOptional(request.MatchResult),
            NormalizeOptional(request.Competition),
            NormalizeOptional(request.OpponentName),
            opponentLogoUrl,
            cancellationToken);

        if (upload is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Session not found", "The requested session does not exist.", ApiErrorCodes.ResourceNotFound);
        }

        return Ok(ToResponse(upload));
    }

    [HttpPut("{id:guid}/smoothing-filter")]
    public async Task<ActionResult<TcxUploadResponseDto>> UpdateSessionSmoothingFilter(Guid id, [FromBody] UpdateSmoothingFilterRequestDto request, CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Filter) || !TcxSmoothingFilters.Supported.Contains(request.Filter))
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Unsupported smoothing filter", $"Unsupported filter. Supported values: {string.Join(", ", TcxSmoothingFilters.Supported)}.", ApiErrorCodes.ValidationError);
        }

        var upload = await _tcxSessionUseCase.UpdateSessionSmoothingFilterAsync(id, request.Filter, cancellationToken);
        if (upload is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Session not found", "The requested session does not exist.", ApiErrorCodes.ResourceNotFound);
        }

        return Ok(ToResponse(upload));
    }

    [HttpPut("{id:guid}/speed-unit")]
    public async Task<ActionResult<TcxUploadResponseDto>> UpdateSessionSpeedUnit(Guid id, [FromBody] UpdateSpeedUnitRequestDto request, CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.SpeedUnit) || !SpeedUnits.Supported.Contains(request.SpeedUnit, StringComparer.OrdinalIgnoreCase))
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Unsupported speed unit", $"Unsupported speed unit. Supported values: {string.Join(", ", SpeedUnits.Supported)}.", ApiErrorCodes.ValidationError);
        }

        var upload = await _tcxSessionUseCase.UpdateSessionSpeedUnitAsync(id, request.SpeedUnit, cancellationToken);
        if (upload is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Session not found", "The requested session does not exist.", ApiErrorCodes.ResourceNotFound);
        }

        return Ok(ToResponse(upload));
    }

    [HttpPost("{id:guid}/segments")]
    public async Task<ActionResult<TcxUploadResponseDto>> AddSegment(Guid id, [FromBody] CreateSegmentRequestDto request, CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Label))
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid segment", "Segment label is required.", ApiErrorCodes.ValidationError);
        }

        try
        {
            var upload = await _tcxSessionUseCase.AddSegmentAsync(id, request.Label, request.StartSecond, request.EndSecond, request.Reason, request.Category, cancellationToken);
            if (upload is null)
            {
                return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Session not found", "The requested session does not exist.", ApiErrorCodes.ResourceNotFound);
            }

            return Ok(ToResponse(upload));
        }
        catch (InvalidDataException ex)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid segment", ex.Message, ApiErrorCodes.ValidationError);
        }
    }

    [HttpPut("{id:guid}/segments/{segmentId:guid}")]
    public async Task<ActionResult<TcxUploadResponseDto>> UpdateSegment(Guid id, Guid segmentId, [FromBody] UpdateSegmentRequestDto request, CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid segment", "Request body is required.", ApiErrorCodes.ValidationError);
        }

        try
        {
            var upload = await _tcxSessionUseCase.UpdateSegmentAsync(id, segmentId, request.Label, request.StartSecond, request.EndSecond, request.Reason, request.Category, cancellationToken);
            if (upload is null)
            {
                return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Segment or session not found", "The requested segment or session does not exist.", ApiErrorCodes.ResourceNotFound);
            }

            return Ok(ToResponse(upload));
        }
        catch (InvalidDataException ex)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid segment", ex.Message, ApiErrorCodes.ValidationError);
        }
    }

    [HttpDelete("{id:guid}/segments/{segmentId:guid}")]
    public async Task<ActionResult<TcxUploadResponseDto>> DeleteSegment(Guid id, Guid segmentId, [FromQuery] string? reason, CancellationToken cancellationToken)
    {
        var upload = await _tcxSessionUseCase.DeleteSegmentAsync(id, segmentId, reason, cancellationToken);
        if (upload is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Segment or session not found", "The requested segment or session does not exist.", ApiErrorCodes.ResourceNotFound);
        }

        return Ok(ToResponse(upload));
    }

    [HttpPost("{id:guid}/segments/merge")]
    public async Task<ActionResult<TcxUploadResponseDto>> MergeSegments(Guid id, [FromBody] MergeSegmentsRequestDto request, CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid segment merge", "Request body is required.", ApiErrorCodes.ValidationError);
        }

        try
        {
            var upload = await _tcxSessionUseCase.MergeSegmentsAsync(id, request.SourceSegmentId, request.TargetSegmentId, request.Label, request.Reason, cancellationToken);
            if (upload is null)
            {
                return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Segment or session not found", "The requested segment or session does not exist.", ApiErrorCodes.ResourceNotFound);
            }

            return Ok(ToResponse(upload));
        }
        catch (InvalidDataException ex)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status400BadRequest, "Invalid segment merge", ex.Message, ApiErrorCodes.ValidationError);
        }
    }

    [HttpPost("{id:guid}/recalculate")]
    public async Task<ActionResult<TcxUploadResponseDto>> RecalculateWithCurrentProfile(Guid id, CancellationToken cancellationToken)
    {
        var upload = await _tcxSessionUseCase.RecalculateWithCurrentProfileAsync(id, cancellationToken);
        if (upload is null)
        {
            return ApiProblemDetailsFactory.Create(this, StatusCodes.Status404NotFound, "Session not found", "The requested session does not exist.", ApiErrorCodes.ResourceNotFound);
        }

        return Ok(ToResponse(upload));
    }

    private TcxUploadResponseDto ToResponse(TcxUpload upload)
        => new(
            upload.Id,
            upload.FileName,
            upload.UploadedAtUtc,
            _tcxSessionUseCase.ResolveSummary(upload),
            new SessionContextResponseDto(upload.SessionType, upload.MatchResult, upload.Competition, upload.OpponentName, upload.OpponentLogoUrl),
            upload.SelectedSmoothingFilterSource,
            upload.SelectedSpeedUnitSource,
            upload.SelectedSpeedUnit,
            _tcxSessionUseCase.ResolveAppliedProfileSnapshot(upload),
            _tcxSessionUseCase.ResolveRecalculationHistory(upload),
            _tcxSessionUseCase.ResolveSegments(upload),
            _tcxSessionUseCase.ResolveSegmentChangeHistory(upload));

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
