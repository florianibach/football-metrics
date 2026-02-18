using System.Security.Cryptography;
using System.Text.Json;
using System.Xml.Linq;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.Services;

namespace FootballMetrics.Api.UseCases;

public class TcxSessionUseCase : ITcxSessionUseCase
{
    private const long MaxFileSizeInBytes = 20 * 1024 * 1024;

    private readonly ITcxUploadRepository _repository;
    private readonly ILogger<TcxSessionUseCase> _logger;
    private readonly IUploadFormatAdapterResolver _uploadFormatAdapterResolver;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IMetricThresholdResolver _metricThresholdResolver;

    public TcxSessionUseCase(
        ITcxUploadRepository repository,
        IUploadFormatAdapterResolver uploadFormatAdapterResolver,
        IUserProfileRepository userProfileRepository,
        IMetricThresholdResolver metricThresholdResolver,
        ILogger<TcxSessionUseCase> logger)
    {
        _repository = repository;
        _uploadFormatAdapterResolver = uploadFormatAdapterResolver;
        _userProfileRepository = userProfileRepository;
        _metricThresholdResolver = metricThresholdResolver;
        _logger = logger;
    }

    public async Task<TcxUpload> UploadTcxAsync(IFormFile file, CancellationToken cancellationToken)
    {
        byte[] rawFileBytes;
        await using (var uploadStream = file.OpenReadStream())
        {
            using var memoryStream = new MemoryStream();
            await uploadStream.CopyToAsync(memoryStream, cancellationToken);
            rawFileBytes = memoryStream.ToArray();
        }

        var adapter = _uploadFormatAdapterResolver.ResolveByFileName(file.FileName)!;
        var parseResult = await adapter.ParseAsync(rawFileBytes, cancellationToken);
        var profile = await _userProfileRepository.GetAsync(cancellationToken);
        var metricThresholdSnapshot = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken);
        var defaultSmoothingFilter = NormalizeSmoothingFilter(profile.DefaultSmoothingFilter);
        var defaultSpeedUnit = NormalizeSpeedUnit(profile.PreferredSpeedUnit);
        var appliedProfileSnapshot = CreateAppliedProfileSnapshot(metricThresholdSnapshot, defaultSmoothingFilter);

        var upload = new TcxUpload
        {
            Id = Guid.NewGuid(),
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
            RecalculationHistoryJson = JsonSerializer.Serialize(Array.Empty<SessionRecalculationEntry>()),
            SelectedSpeedUnit = defaultSpeedUnit,
            SelectedSpeedUnitSource = TcxSpeedUnitSources.ProfileDefault
        };

        try
        {
            await _repository.AddAsync(upload, cancellationToken);
            await RefreshAdaptiveStatsAsync(upload, cancellationToken);
            return upload;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to store upload {FileName}", file.FileName);

            await EnsureFailedUploadMarkerAsync(new TcxUpload
            {
                Id = upload.Id,
                FileName = file.FileName,
                StoredFilePath = string.Empty,
                RawFileContent = rawFileBytes,
                ContentHashSha256 = upload.ContentHashSha256,
                UploadStatus = TcxUploadStatuses.Failed,
                FailureReason = "StorageError",
                UploadedAtUtc = DateTime.UtcNow
            }, cancellationToken);

            throw;
        }
    }

    public Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken)
        => _repository.ListAsync(cancellationToken);

    public Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
        => _repository.GetByIdAsync(id, cancellationToken);

    public async Task<TcxUpload?> UpdateSessionContextAsync(Guid id, string sessionType, string? matchResult, string? competition, string? opponentName, string? opponentLogoUrl, CancellationToken cancellationToken)
    {
        var normalizedSessionType = NormalizeSessionType(sessionType);
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
            return null;
        }

        var refreshedUpload = await _repository.GetByIdAsync(id, cancellationToken);
        if (refreshedUpload is not null)
        {
            await RefreshAdaptiveStatsAsync(refreshedUpload, cancellationToken);
        }

        return refreshedUpload;
    }

    public async Task<TcxUpload?> UpdateSessionSmoothingFilterAsync(Guid id, string smoothingFilter, CancellationToken cancellationToken)
    {
        var normalizedFilter = NormalizeSmoothingFilter(smoothingFilter);

        var wasUpdated = await _repository.UpdateSessionPreferencesAndSnapshotsAsync(
            id,
            normalizedFilter,
            TcxSmoothingFilterSources.ManualOverride,
            null,
            null,
            null,
            null,
            null,
            cancellationToken);

        if (!wasUpdated)
        {
            return null;
        }

        return await _repository.GetByIdAsync(id, cancellationToken);
    }

    public async Task<TcxUpload?> UpdateSessionSpeedUnitAsync(Guid id, string speedUnit, CancellationToken cancellationToken)
    {
        var normalizedSpeedUnit = NormalizeSpeedUnit(speedUnit);

        var wasUpdated = await _repository.UpdateSessionPreferencesAndSnapshotsAsync(
            id,
            null,
            null,
            normalizedSpeedUnit,
            TcxSpeedUnitSources.ManualOverride,
            null,
            null,
            null,
            cancellationToken);

        if (!wasUpdated)
        {
            return null;
        }

        return await _repository.GetByIdAsync(id, cancellationToken);
    }

    public async Task<TcxUpload?> RecalculateWithCurrentProfileAsync(Guid id, CancellationToken cancellationToken)
    {
        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return null;
        }

        var profile = await _userProfileRepository.GetAsync(cancellationToken);
        var normalizedFilter = NormalizeSmoothingFilter(profile.DefaultSmoothingFilter);
        var normalizedSpeedUnit = NormalizeSpeedUnit(profile.PreferredSpeedUnit);
        var effectiveThresholds = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken);
        var newSnapshot = CreateAppliedProfileSnapshot(effectiveThresholds, normalizedFilter);
        var previousSnapshot = ResolveAppliedProfileSnapshot(upload);
        var previousHistory = ResolveRecalculationHistory(upload);
        var nextHistory = previousHistory
            .Concat(new[] { new SessionRecalculationEntry(DateTime.UtcNow, previousSnapshot, newSnapshot) })
            .ToArray();

        var updated = await _repository.UpdateSessionPreferencesAndSnapshotsAsync(
            id,
            normalizedFilter,
            TcxSmoothingFilterSources.ProfileRecalculation,
            normalizedSpeedUnit,
            TcxSpeedUnitSources.ProfileRecalculation,
            JsonSerializer.Serialize(effectiveThresholds),
            JsonSerializer.Serialize(newSnapshot),
            JsonSerializer.Serialize(nextHistory),
            cancellationToken);

        if (!updated)
        {
            return null;
        }

        var refreshedUpload = await _repository.GetByIdAsync(id, cancellationToken);
        if (refreshedUpload is not null)
        {
            await RefreshAdaptiveStatsAsync(refreshedUpload, cancellationToken);
        }

        return refreshedUpload;
    }

    public TcxActivitySummary CreateSummaryFromRawContent(byte[] rawFileContent, string selectedSmoothingFilter, string? metricThresholdSnapshotJson)
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

    public AppliedProfileSnapshot ResolveAppliedProfileSnapshot(TcxUpload upload)
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

    public IReadOnlyList<SessionRecalculationEntry> ResolveRecalculationHistory(TcxUpload upload)
    {
        if (string.IsNullOrWhiteSpace(upload.RecalculationHistoryJson))
        {
            return Array.Empty<SessionRecalculationEntry>();
        }

        return JsonSerializer.Deserialize<List<SessionRecalculationEntry>>(upload.RecalculationHistoryJson)
            ?? new List<SessionRecalculationEntry>();
    }

    private async Task RefreshAdaptiveStatsAsync(TcxUpload upload, CancellationToken cancellationToken)
    {
        var stats = TryBuildAdaptiveStats(upload.RawFileContent, upload.SelectedSmoothingFilter, upload.MetricThresholdSnapshotJson);
        await _repository.UpsertAdaptiveStatsAsync(upload.Id, stats.MaxSpeedMps, stats.MaxHeartRateBpm, DateTime.UtcNow, cancellationToken);
    }

    private static (double? MaxSpeedMps, int? MaxHeartRateBpm) TryBuildAdaptiveStats(byte[] rawFileContent, string selectedSmoothingFilter, string? metricThresholdSnapshotJson)
    {
        if (rawFileContent.Length == 0)
        {
            return (null, null);
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

            var summary = TcxMetricsExtractor.Extract(document, selectedSmoothingFilter, thresholdProfile);
            return (summary.CoreMetrics.MaxSpeedMetersPerSecond, summary.HeartRateMaxBpm);
        }
        catch
        {
            return (null, null);
        }
    }

    public bool IsUploadValid(IFormFile? file)
        => file is not null && file.Length > 0 && file.Length <= MaxFileSizeInBytes;

    public bool IsAdapterSupported(string fileName)
        => _uploadFormatAdapterResolver.ResolveByFileName(fileName) is not null;

    public static string NormalizeSpeedUnit(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return SpeedUnits.KilometersPerHour;
        }

        return SpeedUnits.Supported.FirstOrDefault(unit => string.Equals(unit, value, StringComparison.OrdinalIgnoreCase))
            ?? SpeedUnits.KilometersPerHour;
    }

    public static string NormalizeSmoothingFilter(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return TcxSmoothingFilters.AdaptiveMedian;
        }

        return TcxSmoothingFilters.Supported.FirstOrDefault(filter => string.Equals(filter, value, StringComparison.OrdinalIgnoreCase))
            ?? TcxSmoothingFilters.AdaptiveMedian;
    }

    public static string NormalizeSessionType(string value)
    {
        var sessionType = value.Trim();
        if (string.Equals(sessionType, TcxSessionTypes.Training, StringComparison.OrdinalIgnoreCase)) return TcxSessionTypes.Training;
        if (string.Equals(sessionType, TcxSessionTypes.Match, StringComparison.OrdinalIgnoreCase)) return TcxSessionTypes.Match;
        if (string.Equals(sessionType, TcxSessionTypes.Rehab, StringComparison.OrdinalIgnoreCase)) return TcxSessionTypes.Rehab;
        if (string.Equals(sessionType, TcxSessionTypes.Athletics, StringComparison.OrdinalIgnoreCase)) return TcxSessionTypes.Athletics;
        return TcxSessionTypes.Other;
    }

    private static AppliedProfileSnapshot CreateAppliedProfileSnapshot(MetricThresholdProfile thresholds, string smoothingFilter)
        => new(thresholds.Version, thresholds.UpdatedAtUtc, smoothingFilter, DateTime.UtcNow);

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
