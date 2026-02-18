using System.Security.Cryptography;
using System.Text.Json;
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
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IMetricThresholdResolver _metricThresholdResolver;

    public TcxController(
        ITcxUploadRepository repository,
        IUploadFormatAdapterResolver uploadFormatAdapterResolver,
        IUserProfileRepository userProfileRepository,
        IMetricThresholdResolver metricThresholdResolver,
        ILogger<TcxController> logger)
    {
        _repository = repository;
        _uploadFormatAdapterResolver = uploadFormatAdapterResolver;
        _userProfileRepository = userProfileRepository;
        _metricThresholdResolver = metricThresholdResolver;
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
        var profile = await _userProfileRepository.GetAsync(cancellationToken);
        var metricThresholdSnapshot = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken);
        var defaultSmoothingFilter = NormalizeSmoothingFilter(profile.DefaultSmoothingFilter);
        var appliedProfileSnapshot = CreateAppliedProfileSnapshot(metricThresholdSnapshot, defaultSmoothingFilter);

        var uploadId = Guid.NewGuid();

        var entity = new TcxUpload
        {
            Id = uploadId,
            FileName = file.FileName,
            StoredFilePath = string.Empty,
            RawFileContent = rawFileBytes,
            ContentHashSha256 = Convert.ToHexString(SHA256.HashData(rawFileBytes)),
            UploadStatus = TcxUploadStatuses.Succeeded,
            UploadedAtUtc = DateTime.UtcNow,
            SelectedSmoothingFilter = defaultSmoothingFilter,
            SelectedSmoothingFilterSource = TcxSmoothingFilterSources.ProfileDefault,
            SessionType = TcxSessionTypes.Training,
            MetricThresholdSnapshotJson = JsonSerializer.Serialize(metricThresholdSnapshot),
            AppliedProfileSnapshotJson = JsonSerializer.Serialize(appliedProfileSnapshot),
            RecalculationHistoryJson = JsonSerializer.Serialize(Array.Empty<SessionRecalculationEntry>())
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
                UploadedAtUtc = entity.UploadedAtUtc,
                SessionType = TcxSessionTypes.Training,
                MetricThresholdSnapshotJson = JsonSerializer.Serialize(metricThresholdSnapshot),
                AppliedProfileSnapshotJson = JsonSerializer.Serialize(appliedProfileSnapshot),
                RecalculationHistoryJson = JsonSerializer.Serialize(Array.Empty<SessionRecalculationEntry>())
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

        var responseSummary = CreateSummaryFromRawContent(entity.RawFileContent, entity.SelectedSmoothingFilter, entity.MetricThresholdSnapshotJson);
        var response = new TcxUploadResponse(entity.Id, entity.FileName, entity.UploadedAtUtc, responseSummary, entity.SessionContext(), entity.SelectedSmoothingFilterSource, ResolveAppliedProfileSnapshot(entity), ResolveRecalculationHistory(entity));
        return CreatedAtAction(nameof(GetUploadById), new { id = entity.Id }, response);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TcxUploadResponse>>> GetUploads(CancellationToken cancellationToken)
    {
        var uploads = await _repository.ListAsync(cancellationToken);
        var responses = uploads
            .Select(upload => new TcxUploadResponse(upload.Id, upload.FileName, upload.UploadedAtUtc, CreateSummaryFromRawContent(upload.RawFileContent, upload.SelectedSmoothingFilter, upload.MetricThresholdSnapshotJson), upload.SessionContext(), upload.SelectedSmoothingFilterSource, ResolveAppliedProfileSnapshot(upload), ResolveRecalculationHistory(upload)))
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

        var response = new TcxUploadResponse(upload.Id, upload.FileName, upload.UploadedAtUtc, CreateSummaryFromRawContent(upload.RawFileContent, upload.SelectedSmoothingFilter, upload.MetricThresholdSnapshotJson), upload.SessionContext(), upload.SelectedSmoothingFilterSource, ResolveAppliedProfileSnapshot(upload), ResolveRecalculationHistory(upload));
        return Ok(response);
    }

    [HttpPut("{id:guid}/session-context")]
    public async Task<ActionResult<TcxUploadResponse>> UpdateSessionContext(Guid id, [FromBody] UpdateSessionContextRequest request, CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.SessionType) || !TcxSessionTypes.Supported.Contains(request.SessionType))
        {
            return BadRequest($"Unsupported session type. Supported values: {string.Join(", ", TcxSessionTypes.Supported)}.");
        }

        var normalizedSessionType = NormalizeSessionType(request.SessionType);
        var matchResult = NormalizeOptional(request.MatchResult);
        var competition = NormalizeOptional(request.Competition);
        var opponentName = NormalizeOptional(request.OpponentName);
        var opponentLogoUrl = NormalizeOptional(request.OpponentLogoUrl);

        if (!string.IsNullOrWhiteSpace(opponentLogoUrl) && !Uri.TryCreate(opponentLogoUrl, UriKind.Absolute, out _))
        {
            return BadRequest("OpponentLogoUrl must be an absolute URL.");
        }

        if (!string.Equals(normalizedSessionType, TcxSessionTypes.Match, StringComparison.Ordinal))
        {
            matchResult = null;
            competition = null;
            opponentName = null;
            opponentLogoUrl = null;
        }

        var updated = await _repository.UpdateSessionContextAsync(id, normalizedSessionType, matchResult, competition, opponentName, opponentLogoUrl, cancellationToken);
        if (!updated)
        {
            return NotFound();
        }

        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return NotFound();
        }

        var response = new TcxUploadResponse(upload.Id, upload.FileName, upload.UploadedAtUtc, CreateSummaryFromRawContent(upload.RawFileContent, upload.SelectedSmoothingFilter, upload.MetricThresholdSnapshotJson), upload.SessionContext(), upload.SelectedSmoothingFilterSource, ResolveAppliedProfileSnapshot(upload), ResolveRecalculationHistory(upload));
        return Ok(response);
    }

    [HttpPut("{id:guid}/smoothing-filter")]
    public async Task<ActionResult<TcxUploadResponse>> UpdateSessionSmoothingFilter(Guid id, [FromBody] UpdateSmoothingFilterRequest request, CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Filter) || !TcxSmoothingFilters.Supported.Contains(request.Filter))
        {
            return BadRequest($"Unsupported filter. Supported values: {string.Join(", ", TcxSmoothingFilters.Supported)}.");
        }

        var normalizedFilter = TcxSmoothingFilters.Supported.First(filter => string.Equals(filter, request.Filter, StringComparison.OrdinalIgnoreCase));
        var wasUpdated = await _repository.UpdateSelectedSmoothingFilterAsync(id, normalizedFilter, cancellationToken);
        if (!wasUpdated)
        {
            return NotFound();
        }

        await _repository.UpdateSelectedSmoothingFilterSourceAsync(id, TcxSmoothingFilterSources.ManualOverride, cancellationToken);

        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return NotFound();
        }

        var response = new TcxUploadResponse(upload.Id, upload.FileName, upload.UploadedAtUtc, CreateSummaryFromRawContent(upload.RawFileContent, upload.SelectedSmoothingFilter, upload.MetricThresholdSnapshotJson), upload.SessionContext(), upload.SelectedSmoothingFilterSource, ResolveAppliedProfileSnapshot(upload), ResolveRecalculationHistory(upload));
        return Ok(response);
    }

    [HttpPost("{id:guid}/recalculate")]
    public async Task<ActionResult<TcxUploadResponse>> RecalculateWithCurrentProfile(Guid id, CancellationToken cancellationToken)
    {
        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return NotFound();
        }

        var profile = await _userProfileRepository.GetAsync(cancellationToken);
        var normalizedFilter = NormalizeSmoothingFilter(profile.DefaultSmoothingFilter);
        var effectiveThresholds = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken);
        var newSnapshot = CreateAppliedProfileSnapshot(effectiveThresholds, normalizedFilter);
        var previousSnapshot = ResolveAppliedProfileSnapshot(upload);
        var previousHistory = ResolveRecalculationHistory(upload);
        var nextHistory = previousHistory
            .Concat(new[] { new SessionRecalculationEntry(DateTime.UtcNow, previousSnapshot, newSnapshot) })
            .ToArray();

        var updated = await _repository.UpdateSelectedSmoothingFilterAsync(id, normalizedFilter, cancellationToken);
        if (!updated)
        {
            return NotFound();
        }

        await _repository.UpdateSelectedSmoothingFilterSourceAsync(id, TcxSmoothingFilterSources.ProfileRecalculation, cancellationToken);
        await _repository.UpdateProfileSnapshotsAsync(
            id,
            JsonSerializer.Serialize(effectiveThresholds),
            JsonSerializer.Serialize(newSnapshot),
            JsonSerializer.Serialize(nextHistory),
            cancellationToken);

        var refreshed = await _repository.GetByIdAsync(id, cancellationToken);
        if (refreshed is null)
        {
            return NotFound();
        }

        var response = new TcxUploadResponse(
            refreshed.Id,
            refreshed.FileName,
            refreshed.UploadedAtUtc,
            CreateSummaryFromRawContent(refreshed.RawFileContent, refreshed.SelectedSmoothingFilter, refreshed.MetricThresholdSnapshotJson),
            refreshed.SessionContext(),
            refreshed.SelectedSmoothingFilterSource,
            ResolveAppliedProfileSnapshot(refreshed),
            ResolveRecalculationHistory(refreshed));
        return Ok(response);
    }

    private static TcxActivitySummary CreateSummaryFromRawContent(byte[] rawFileContent, string selectedSmoothingFilter, string? metricThresholdSnapshotJson)
    {
        if (rawFileContent.Length == 0)
        {
            return new TcxActivitySummary(null, null, 0, null, null, null, null, false, null, "NotAvailable", "Low", new List<string> { "No quality assessment available." }, new TcxSmoothingTrace("NotAvailable", new Dictionary<string, string>(), null, null, 0, 0, 0, 0, DateTime.UtcNow), new TcxFootballCoreMetrics(false, "Core metrics unavailable.", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new Dictionary<string, TcxMetricAvailability>(), new Dictionary<string, string>()), Array.Empty<TcxIntervalAggregate>());
        }

        try
        {
            using var stream = new MemoryStream(rawFileContent, writable: false);
            var document = XDocument.Load(stream);
            MetricThresholdProfile? thresholdProfile = null;
            if (!string.IsNullOrWhiteSpace(metricThresholdSnapshotJson))
            {
                thresholdProfile = JsonSerializer.Deserialize<MetricThresholdProfile>(metricThresholdSnapshotJson);
            }

            return TcxMetricsExtractor.Extract(document, selectedSmoothingFilter, thresholdProfile);
        }
        catch
        {
            return new TcxActivitySummary(null, null, 0, null, null, null, null, false, null, "NotAvailable", "Low", new List<string> { "TCX summary unavailable due to invalid stored content." }, new TcxSmoothingTrace("NotAvailable", new Dictionary<string, string>(), null, null, 0, 0, 0, 0, DateTime.UtcNow), new TcxFootballCoreMetrics(false, "Core metrics unavailable.", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new Dictionary<string, TcxMetricAvailability>(), new Dictionary<string, string>()), Array.Empty<TcxIntervalAggregate>());
        }
    }




    private static AppliedProfileSnapshot CreateAppliedProfileSnapshot(MetricThresholdProfile thresholds, string smoothingFilter)
        => new(
            thresholds.Version,
            thresholds.UpdatedAtUtc,
            smoothingFilter,
            DateTime.UtcNow);

    private static AppliedProfileSnapshot ResolveAppliedProfileSnapshot(TcxUpload upload)
    {
        if (!string.IsNullOrWhiteSpace(upload.AppliedProfileSnapshotJson))
        {
            var deserialized = JsonSerializer.Deserialize<AppliedProfileSnapshot>(upload.AppliedProfileSnapshotJson);
            if (deserialized is not null)
            {
                return deserialized;
            }
        }

        var thresholds = string.IsNullOrWhiteSpace(upload.MetricThresholdSnapshotJson)
            ? MetricThresholdProfile.CreateDefault()
            : JsonSerializer.Deserialize<MetricThresholdProfile>(upload.MetricThresholdSnapshotJson) ?? MetricThresholdProfile.CreateDefault();

        return new AppliedProfileSnapshot(
            thresholds.Version,
            thresholds.UpdatedAtUtc,
            NormalizeSmoothingFilter(upload.SelectedSmoothingFilter),
            upload.UploadedAtUtc);
    }

    private static IReadOnlyList<SessionRecalculationEntry> ResolveRecalculationHistory(TcxUpload upload)
    {
        if (string.IsNullOrWhiteSpace(upload.RecalculationHistoryJson))
        {
            return Array.Empty<SessionRecalculationEntry>();
        }

        return JsonSerializer.Deserialize<List<SessionRecalculationEntry>>(upload.RecalculationHistoryJson)
            ?? new List<SessionRecalculationEntry>();
    }

    private static string NormalizeSmoothingFilter(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return TcxSmoothingFilters.AdaptiveMedian;
        }

        return TcxSmoothingFilters.Supported.FirstOrDefault(filter => string.Equals(filter, value, StringComparison.OrdinalIgnoreCase))
            ?? TcxSmoothingFilters.AdaptiveMedian;
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeSessionType(string value)
    {
        var sessionType = value.Trim();
        if (string.Equals(sessionType, TcxSessionTypes.Training, StringComparison.OrdinalIgnoreCase)) return TcxSessionTypes.Training;
        if (string.Equals(sessionType, TcxSessionTypes.Match, StringComparison.OrdinalIgnoreCase)) return TcxSessionTypes.Match;
        if (string.Equals(sessionType, TcxSessionTypes.Rehab, StringComparison.OrdinalIgnoreCase)) return TcxSessionTypes.Rehab;
        if (string.Equals(sessionType, TcxSessionTypes.Athletics, StringComparison.OrdinalIgnoreCase)) return TcxSessionTypes.Athletics;
        return TcxSessionTypes.Other;
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

public record TcxUploadResponse(Guid Id, string FileName, DateTime UploadedAtUtc, TcxActivitySummary Summary, SessionContextResponse SessionContext, string SelectedSmoothingFilterSource, AppliedProfileSnapshot AppliedProfileSnapshot, IReadOnlyList<SessionRecalculationEntry> RecalculationHistory);
public record SessionContextResponse(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);
public record UpdateSmoothingFilterRequest(string Filter);
public record UpdateSessionContextRequest(string SessionType, string? MatchResult, string? Competition, string? OpponentName, string? OpponentLogoUrl);

internal static class TcxUploadSessionContextExtensions
{
    public static SessionContextResponse SessionContext(this TcxUpload upload)
        => new(upload.SessionType, upload.MatchResult, upload.Competition, upload.OpponentName, upload.OpponentLogoUrl);
}
