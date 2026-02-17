using System.Xml;
using System.Xml.Linq;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TcxController : ControllerBase
{
    private const long MaxFileSizeInBytes = 20 * 1024 * 1024;
    private readonly ITcxUploadRepository _repository;
    private readonly ILogger<TcxController> _logger;
    private readonly IWebHostEnvironment _environment;

    public TcxController(ITcxUploadRepository repository, ILogger<TcxController> logger, IWebHostEnvironment environment)
    {
        _repository = repository;
        _logger = logger;
        _environment = environment;
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

        var tcxValidationError = await ValidateTcxFileAsync(file, cancellationToken);
        if (tcxValidationError is not null)
        {
            return BadRequest(tcxValidationError);
        }

        var uploadsDirectory = Path.Combine(_environment.ContentRootPath, "uploads");
        Directory.CreateDirectory(uploadsDirectory);

        var uploadId = Guid.NewGuid();
        var fileName = $"{uploadId}.tcx";
        var fullPath = Path.Combine(uploadsDirectory, fileName);

        await using (var fileStream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(fileStream, cancellationToken);
        }

        var entity = new TcxUpload
        {
            Id = uploadId,
            FileName = file.FileName,
            StoredFilePath = fullPath,
            UploadedAtUtc = DateTime.UtcNow
        };

        await _repository.AddAsync(entity, cancellationToken);

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

    private static async Task<string?> ValidateTcxFileAsync(IFormFile file, CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = file.OpenReadStream();
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
}

public record TcxUploadResponse(Guid Id, string FileName, DateTime UploadedAtUtc);
