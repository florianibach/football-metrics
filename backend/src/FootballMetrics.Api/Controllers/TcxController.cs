using System.Security.Cryptography;
using System.Xml.Linq;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TcxController : ControllerBase
{
    private const long MaxFileSizeInBytes = 20 * 1024 * 1024;
    private readonly ITcxUploadRepository _repository;
    private readonly ILogger<TcxController> _logger;
    private readonly IUploadFormatAdapterResolver _uploadFormatAdapterResolver;

    public TcxController(
        ITcxUploadRepository repository,
        IUploadFormatAdapterResolver uploadFormatAdapterResolver,
        ILogger<TcxController> logger)
    {
        _repository = repository;
        _uploadFormatAdapterResolver = uploadFormatAdapterResolver;
        _logger = logger;
    }

    [HttpPost("upload")]
    [RequestSizeLimit(MaxFileSizeInBytes)]
    public async Task<ActionResult<TcxUploadResponse>> UploadTcx(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("No file uploaded. Please select a .tcx file and try again.");
        }

        var adapter = _uploadFormatAdapterResolver.ResolveByFileName(file.FileName);
        if (adapter is null)
        {
            var fileExtension = Path.GetExtension(file.FileName);
            var normalizedExtension = string.IsNullOrWhiteSpace(fileExtension) ? "<none>" : fileExtension;
            var supportedExtensions = string.Join(", ", _uploadFormatAdapterResolver.GetSupportedExtensions());

            _logger.LogInformation(
                "Rejected unsupported upload extension {FileExtension}. File {FileName} can be considered for a future adapter.",
                normalizedExtension,
                file.FileName);

            return BadRequest($"File type '{normalizedExtension}' is currently not supported. Supported formats: {supportedExtensions}. The format has been logged for potential future support.");
        }

        if (file.Length > MaxFileSizeInBytes)
        {
            return BadRequest($"File is too large. Maximum supported size is {MaxFileSizeInBytes / (1024 * 1024)} MB.");
        }

        byte[] rawFileBytes;
        await using (var uploadStream = file.OpenReadStream())
        {
            using var memoryStream = new MemoryStream();
            await uploadStream.CopyToAsync(memoryStream, cancellationToken);
            rawFileBytes = memoryStream.ToArray();
        }

        var parseResult = await adapter.ParseAsync(rawFileBytes, cancellationToken);
        if (!parseResult.IsSuccess)
        {
            return BadRequest(parseResult.ErrorMessage);
        }

        var summary = parseResult.Summary!;

        var uploadId = Guid.NewGuid();

        var entity = new TcxUpload
        {
            Id = uploadId,
            FileName = file.FileName,
            StoredFilePath = string.Empty,
            RawFileContent = rawFileBytes,
            ContentHashSha256 = Convert.ToHexString(SHA256.HashData(rawFileBytes)),
            UploadStatus = TcxUploadStatuses.Succeeded,
            UploadedAtUtc = DateTime.UtcNow
        };

        try
        {
            await _repository.AddAsync(entity, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to store raw TCX file {FileName} for upload {UploadId}", entity.FileName, entity.Id);

            var failedEntity = new TcxUpload
            {
                Id = entity.Id,
                FileName = entity.FileName,
                StoredFilePath = entity.StoredFilePath,
                RawFileContent = Array.Empty<byte>(),
                ContentHashSha256 = string.Empty,
                UploadStatus = TcxUploadStatuses.Failed,
                FailureReason = "StorageError",
                UploadedAtUtc = entity.UploadedAtUtc
            };

            await EnsureFailedUploadMarkerAsync(failedEntity, cancellationToken);

            return StatusCode(StatusCodes.Status500InternalServerError,
                "Upload failed while saving your file. Please retry in a moment or contact support if the problem persists.");
        }

        _logger.LogInformation("Uploaded {FormatKey} file {FileName} with id {UploadId}", adapter.FormatKey, entity.FileName, entity.Id);

        if (summary.DistanceMeters.HasValue && summary.FileDistanceMeters.HasValue)
        {
            _logger.LogInformation(
                "Distance deviation for upload {UploadId}: calculated={CalculatedDistanceMeters}m, file={FileDistanceMeters}m, deviation={DeviationMeters}m",
                entity.Id,
                summary.DistanceMeters.Value,
                summary.FileDistanceMeters.Value,
                summary.DistanceMeters.Value - summary.FileDistanceMeters.Value);
        }

        var response = new TcxUploadResponse(entity.Id, entity.FileName, entity.UploadedAtUtc, summary);
        return CreatedAtAction(nameof(GetUploadById), new { id = entity.Id }, response);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TcxUploadResponse>>> GetUploads(CancellationToken cancellationToken)
    {
        var uploads = await _repository.ListAsync(cancellationToken);
        var responses = uploads
            .Select(upload => new TcxUploadResponse(upload.Id, upload.FileName, upload.UploadedAtUtc, CreateSummaryFromRawContent(upload.RawFileContent)))
            .ToList();

        return Ok(responses);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TcxUploadResponse>> GetUploadById(Guid id, CancellationToken cancellationToken)
    {
        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return NotFound();
        }

        var response = new TcxUploadResponse(upload.Id, upload.FileName, upload.UploadedAtUtc, CreateSummaryFromRawContent(upload.RawFileContent));
        return Ok(response);
    }

    private static TcxActivitySummary CreateSummaryFromRawContent(byte[] rawFileContent)
    {
        if (rawFileContent.Length == 0)
        {
            return new TcxActivitySummary(null, null, 0, null, null, null, null, false, null, "NotAvailable", "Low", new List<string> { "No quality assessment available." }, new TcxSmoothingTrace("NotAvailable", new Dictionary<string, string>(), null, null, 0, 0, 0, 0, DateTime.UtcNow), new TcxFootballCoreMetrics(false, "Core metrics unavailable.", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new Dictionary<string, TcxMetricAvailability>(), new Dictionary<string, string>()));
        }

        try
        {
            using var stream = new MemoryStream(rawFileContent, writable: false);
            var document = XDocument.Load(stream);
            return TcxMetricsExtractor.Extract(document);
        }
        catch
        {
            return new TcxActivitySummary(null, null, 0, null, null, null, null, false, null, "NotAvailable", "Low", new List<string> { "TCX summary unavailable due to invalid stored content." }, new TcxSmoothingTrace("NotAvailable", new Dictionary<string, string>(), null, null, 0, 0, 0, 0, DateTime.UtcNow), new TcxFootballCoreMetrics(false, "Core metrics unavailable.", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new Dictionary<string, TcxMetricAvailability>(), new Dictionary<string, string>()));
        }
    }

    private async Task EnsureFailedUploadMarkerAsync(TcxUpload failedUpload, CancellationToken cancellationToken)
    {
        try
        {
            await _repository.AddAsync(failedUpload, cancellationToken);
            return;
        }
        catch (Exception sameIdPersistFailureException)
        {
            _logger.LogWarning(
                sameIdPersistFailureException,
                "Could not persist failed upload marker for {UploadId} with original id",
                failedUpload.Id);
        }

        var fallbackFailedUpload = new TcxUpload
        {
            Id = Guid.NewGuid(),
            FileName = failedUpload.FileName,
            StoredFilePath = failedUpload.StoredFilePath,
            RawFileContent = failedUpload.RawFileContent,
            ContentHashSha256 = failedUpload.ContentHashSha256,
            UploadStatus = failedUpload.UploadStatus,
            FailureReason = $"{failedUpload.FailureReason}|OriginalUploadId:{failedUpload.Id}",
            UploadedAtUtc = failedUpload.UploadedAtUtc
        };

        try
        {
            await _repository.AddAsync(fallbackFailedUpload, cancellationToken);
        }
        catch (Exception fallbackPersistFailureException)
        {
            _logger.LogWarning(
                fallbackPersistFailureException,
                "Could not persist fallback failed upload marker for original upload {UploadId}",
                failedUpload.Id);
        }
    }
}

public record TcxUploadResponse(Guid Id, string FileName, DateTime UploadedAtUtc, TcxActivitySummary Summary);
