using System.Xml;
using System.Xml.Linq;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TcxController : ControllerBase
{
    private const long MaxFileSizeInBytes = 20 * 1024 * 1024;
    private readonly ITcxUploadRepository _repository;
    private readonly ILogger<TcxController> _logger;

    public TcxController(ITcxUploadRepository repository, ILogger<TcxController> logger)
    {
        _repository = repository;
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

        if (!string.Equals(Path.GetExtension(file.FileName), ".tcx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Only .tcx files are supported. Please upload a valid TCX export.");
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

        var tcxValidationError = await ValidateTcxFileAsync(rawFileBytes, cancellationToken);
        if (tcxValidationError is not null)
        {
            return BadRequest(tcxValidationError);
        }

        var uploadId = Guid.NewGuid();

        var entity = new TcxUpload
        {
            Id = uploadId,
            FileName = file.FileName,
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

        _logger.LogInformation("Uploaded TCX file {FileName} with id {UploadId}", entity.FileName, entity.Id);

        var response = new TcxUploadResponse(entity.Id, entity.FileName, entity.UploadedAtUtc);
        return CreatedAtAction(nameof(GetUploads), response);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TcxUploadResponse>>> GetUploads(CancellationToken cancellationToken)
    {
        var uploads = await _repository.ListAsync(cancellationToken);
        return Ok(uploads.Select(item => new TcxUploadResponse(item.Id, item.FileName, item.UploadedAtUtc)).ToList());
    }

    private static async Task<string?> ValidateTcxFileAsync(byte[] rawFileBytes, CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = new MemoryStream(rawFileBytes, writable: false);
            var document = await XDocument.LoadAsync(stream, LoadOptions.None, cancellationToken);
            var rootName = document.Root?.Name.LocalName;

            if (!string.Equals(rootName, "TrainingCenterDatabase", StringComparison.OrdinalIgnoreCase))
            {
                return "File content is invalid. Expected a TCX TrainingCenterDatabase document. Please export the file again from your device.";
            }

            var hasActivities = document
                .Descendants()
                .Any(node => string.Equals(node.Name.LocalName, "Activity", StringComparison.OrdinalIgnoreCase));

            if (!hasActivities)
            {
                return "File appears incomplete. No Activity section found. Please verify the export includes workout data.";
            }

            var hasTrackpoints = document
                .Descendants()
                .Any(node => string.Equals(node.Name.LocalName, "Trackpoint", StringComparison.OrdinalIgnoreCase));

            if (!hasTrackpoints)
            {
                return "File appears incomplete. No Trackpoint entries found. Please export the workout with detailed points.";
            }

            return null;
        }
        catch (XmlException)
        {
            return "File is unreadable or corrupted XML. Please open the file in your exporter and create a new TCX export.";
        }
        catch (InvalidDataException)
        {
            return "File could not be read. Please check the file and upload a valid TCX export.";
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

public record TcxUploadResponse(Guid Id, string FileName, DateTime UploadedAtUtc);
