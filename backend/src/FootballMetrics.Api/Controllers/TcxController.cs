using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TcxController : ControllerBase
{
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
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<ActionResult<TcxUploadResponse>> UploadTcx(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("No file uploaded.");
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".tcx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Only .tcx files are supported.");
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
}

public record TcxUploadResponse(Guid Id, string FileName, DateTime UploadedAtUtc);
