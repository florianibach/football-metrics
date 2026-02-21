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

    public async Task<UploadTcxOutcome> UploadTcxAsync(IFormFile file, string? idempotencyKey, CancellationToken cancellationToken)
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
        if (!parseResult.IsSuccess)
        {
            throw new InvalidDataException(parseResult.ErrorMessage ?? "The uploaded file could not be parsed.");
        }

        var contentHashSha256 = Convert.ToHexString(SHA256.HashData(rawFileBytes));
        var normalizedIdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey.Trim();

        if (normalizedIdempotencyKey is not null)
        {
            var existingByKey = await _repository.GetByIdempotencyKeyAsync(normalizedIdempotencyKey, cancellationToken);
            if (existingByKey is not null)
            {
                if (!string.Equals(existingByKey.ContentHashSha256, contentHashSha256, StringComparison.OrdinalIgnoreCase))
                {
                    throw new IdempotencyConflictException("The provided Idempotency-Key was already used for a different upload payload.");
                }

                return new UploadTcxOutcome(existingByKey, false);
            }
        }

        var profile = await _userProfileRepository.GetAsync(cancellationToken);
        var metricThresholdSnapshot = await _metricThresholdResolver.ResolveEffectiveAsync(profile.MetricThresholds, cancellationToken);
        var defaultSmoothingFilter = NormalizeSmoothingFilter(profile.DefaultSmoothingFilter);
        var defaultSpeedUnit = NormalizeSpeedUnit(profile.PreferredSpeedUnit);
        var appliedProfileSnapshot = CreateAppliedProfileSnapshot(metricThresholdSnapshot, defaultSmoothingFilter);

        var summarySnapshot = CreateSummaryFromRawContent(rawFileBytes, defaultSmoothingFilter, JsonSerializer.Serialize(metricThresholdSnapshot));

        var upload = new TcxUpload
        {
            Id = Guid.NewGuid(),
            FileName = file.FileName,
            StoredFilePath = string.Empty,
            RawFileContent = rawFileBytes,
            ContentHashSha256 = contentHashSha256,
            UploadStatus = TcxUploadStatuses.Succeeded,
            UploadedAtUtc = DateTime.UtcNow,
            SelectedSmoothingFilter = defaultSmoothingFilter,
            SelectedSmoothingFilterSource = TcxSmoothingFilterSources.ProfileDefault,
            SessionType = TcxSessionTypes.Training,
            MetricThresholdSnapshotJson = JsonSerializer.Serialize(metricThresholdSnapshot),
            AppliedProfileSnapshotJson = JsonSerializer.Serialize(appliedProfileSnapshot),
            RecalculationHistoryJson = JsonSerializer.Serialize(Array.Empty<SessionRecalculationEntry>()),
            SessionSummarySnapshotJson = JsonSerializer.Serialize(summarySnapshot),
            SelectedSpeedUnit = defaultSpeedUnit,
            SelectedSpeedUnitSource = TcxSpeedUnitSources.ProfileDefault,
            IdempotencyKey = normalizedIdempotencyKey,
            SegmentsSnapshotJson = JsonSerializer.Serialize(Array.Empty<TcxSessionSegment>()),
            SegmentChangeHistoryJson = JsonSerializer.Serialize(Array.Empty<TcxSegmentChangeEntry>())
        };

        try
        {
            await _repository.AddWithAdaptiveStatsAsync(upload, summarySnapshot.CoreMetrics.MaxSpeedMetersPerSecond, summarySnapshot.HeartRateMaxBpm, DateTime.UtcNow, cancellationToken);
            return new UploadTcxOutcome(upload, true);
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

        var current = await _repository.GetByIdAsync(id, cancellationToken);
        if (current is null)
        {
            return null;
        }

        var summarySnapshot = CreateSummaryFromRawContent(current.RawFileContent, normalizedFilter, current.MetricThresholdSnapshotJson);

        var wasUpdated = await _repository.UpdateSessionPreferencesAndSnapshotsAsync(
            id,
            normalizedFilter,
            TcxSmoothingFilterSources.ManualOverride,
            null,
            null,
            null,
            null,
            null,
            JsonSerializer.Serialize(summarySnapshot),
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
            null,
            cancellationToken);

        if (!wasUpdated)
        {
            return null;
        }

        return await _repository.GetByIdAsync(id, cancellationToken);
    }


    public async Task<bool> DeleteSessionAsync(Guid id, CancellationToken cancellationToken)
    {
        return await _repository.DeleteAsync(id, cancellationToken);
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

        var summarySnapshot = CreateSummaryFromRawContent(upload.RawFileContent, normalizedFilter, JsonSerializer.Serialize(effectiveThresholds));

        var updated = await _repository.UpdateSessionPreferencesAndSnapshotsAsync(
            id,
            normalizedFilter,
            TcxSmoothingFilterSources.ProfileRecalculation,
            normalizedSpeedUnit,
            TcxSpeedUnitSources.ProfileRecalculation,
            JsonSerializer.Serialize(effectiveThresholds),
            JsonSerializer.Serialize(newSnapshot),
            JsonSerializer.Serialize(nextHistory),
            JsonSerializer.Serialize(summarySnapshot),
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

    public async Task<TcxUpload?> AddSegmentAsync(Guid id, string label, int startSecond, int endSecond, string? notes, string? category, CancellationToken cancellationToken)
    {
        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return null;
        }

        var normalizedLabel = NormalizeSegmentLabel(label);
        ValidateSegmentRange(startSecond, endSecond);

        var segments = ResolveSegments(upload).ToList();
        if (IsSyntheticDefaultOnly(segments, upload.Id))
        {
            segments.Clear();
        }

        EnsureNoInvalidOverlap(segments, startSecond, endSecond, null);

        segments.Add(new TcxSessionSegment(Guid.NewGuid(), normalizedLabel, startSecond, endSecond, NormalizeSegmentCategory(category)));
        var nextHistory = AppendSegmentHistory(upload, "Created", notes, segments);

        var updated = await _repository.UpdateSegmentsAsync(id, JsonSerializer.Serialize(segments), JsonSerializer.Serialize(nextHistory), cancellationToken);
        return updated ? await _repository.GetByIdAsync(id, cancellationToken) : null;
    }

    public async Task<TcxUpload?> UpdateSegmentAsync(Guid id, Guid segmentId, string? label, int? startSecond, int? endSecond, string? notes, string? category, CancellationToken cancellationToken)
    {
        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return null;
        }

        var segments = ResolveSegments(upload).ToList();
        var index = segments.FindIndex(segment => segment.Id == segmentId);
        if (index < 0)
        {
            return null;
        }

        var existing = segments[index];
        var nextLabel = string.IsNullOrWhiteSpace(label) ? existing.Label : NormalizeSegmentLabel(label);
        var nextStart = startSecond ?? existing.StartSecond;
        var nextEnd = endSecond ?? existing.EndSecond;

        ValidateSegmentRange(nextStart, nextEnd);
        EnsureNoInvalidOverlap(segments, nextStart, nextEnd, segmentId);

        segments[index] = existing with { Label = nextLabel, StartSecond = nextStart, EndSecond = nextEnd, Category = NormalizeSegmentCategory(category ?? existing.Category) };
        var nextHistory = AppendSegmentHistory(upload, "Updated", notes, segments);

        var updated = await _repository.UpdateSegmentsAsync(id, JsonSerializer.Serialize(segments), JsonSerializer.Serialize(nextHistory), cancellationToken);
        return updated ? await _repository.GetByIdAsync(id, cancellationToken) : null;
    }

    public async Task<TcxUpload?> DeleteSegmentAsync(Guid id, Guid segmentId, string? notes, CancellationToken cancellationToken)
    {
        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return null;
        }

        var segments = ResolveSegments(upload).ToList();
        var removed = segments.RemoveAll(segment => segment.Id == segmentId);
        if (removed == 0)
        {
            return null;
        }

        var nextHistory = AppendSegmentHistory(upload, "Deleted", notes, segments);
        var updated = await _repository.UpdateSegmentsAsync(id, JsonSerializer.Serialize(segments), JsonSerializer.Serialize(nextHistory), cancellationToken);
        return updated ? await _repository.GetByIdAsync(id, cancellationToken) : null;
    }

    public async Task<TcxUpload?> MergeSegmentsAsync(Guid id, Guid sourceSegmentId, Guid targetSegmentId, string? label, string? notes, CancellationToken cancellationToken)
    {
        if (sourceSegmentId == targetSegmentId)
        {
            throw new InvalidDataException("Source and target segment must differ.");
        }

        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return null;
        }

        var segments = ResolveSegments(upload).ToList();
        var source = segments.SingleOrDefault(segment => segment.Id == sourceSegmentId);
        var target = segments.SingleOrDefault(segment => segment.Id == targetSegmentId);
        if (source is null || target is null)
        {
            return null;
        }

        var merged = new TcxSessionSegment(
            target.Id,
            string.IsNullOrWhiteSpace(label) ? target.Label : NormalizeSegmentLabel(label),
            Math.Min(source.StartSecond, target.StartSecond),
            Math.Max(source.EndSecond, target.EndSecond),
            target.Category);

        segments.RemoveAll(segment => segment.Id == sourceSegmentId || segment.Id == targetSegmentId);
        EnsureNoInvalidOverlap(segments, merged.StartSecond, merged.EndSecond, null);
        segments.Add(merged);

        var nextHistory = AppendSegmentHistory(upload, "Merged", notes, segments);
        var updated = await _repository.UpdateSegmentsAsync(id, JsonSerializer.Serialize(segments), JsonSerializer.Serialize(nextHistory), cancellationToken);
        return updated ? await _repository.GetByIdAsync(id, cancellationToken) : null;
    }

    public async Task<TcxUpload?> SplitSegmentAsync(Guid id, Guid segmentId, int splitSecond, string? leftLabel, string? rightLabel, string? notes, CancellationToken cancellationToken)
    {
        var upload = await _repository.GetByIdAsync(id, cancellationToken);
        if (upload is null)
        {
            return null;
        }

        var segments = ResolveSegments(upload).OrderBy(segment => segment.StartSecond).ToList();
        var segmentToSplit = segments.SingleOrDefault(segment => segment.Id == segmentId);
        if (segmentToSplit is null)
        {
            return null;
        }

        if (splitSecond <= segmentToSplit.StartSecond || splitSecond >= segmentToSplit.EndSecond)
        {
            throw new InvalidDataException("Split second must be inside the selected segment boundaries.");
        }

        segments.RemoveAll(segment => segment.Id == segmentId);
        segments.Add(new TcxSessionSegment(Guid.NewGuid(), string.IsNullOrWhiteSpace(leftLabel) ? $"{segmentToSplit.Label} A" : NormalizeSegmentLabel(leftLabel), segmentToSplit.StartSecond, splitSecond, segmentToSplit.Category));
        segments.Add(new TcxSessionSegment(Guid.NewGuid(), string.IsNullOrWhiteSpace(rightLabel) ? $"{segmentToSplit.Label} B" : NormalizeSegmentLabel(rightLabel), splitSecond, segmentToSplit.EndSecond, segmentToSplit.Category));

        var nextHistory = AppendSegmentHistory(upload, "Split", notes, segments);
        var updated = await _repository.UpdateSegmentsAsync(id, JsonSerializer.Serialize(segments), JsonSerializer.Serialize(nextHistory), cancellationToken);
        return updated ? await _repository.GetByIdAsync(id, cancellationToken) : null;
    }

    public TcxActivitySummary CreateSummaryFromRawContent(byte[] rawFileContent, string selectedSmoothingFilter, string? metricThresholdSnapshotJson)
    {
        if (rawFileContent.Length == 0)
        {
            return new TcxActivitySummary(null, null, 0, null, null, null, null, false, null, "NotAvailable", "Low", new List<string> { "No quality assessment available." }, new TcxDataAvailability("NotAvailable", "NotMeasured", "GPS not present in this session.", "NotMeasured", "Heart-rate data not present in this session.", "Low", new List<string> { "No GPS quality assessment available." }, "Low", new List<string> { "No heart-rate quality assessment available." }), Array.Empty<TcxGpsTrackpoint>(), new TcxSmoothingTrace("NotAvailable", new Dictionary<string, string>(), null, null, 0, 0, 0, 0, 0, 0, "NotAvailable", DateTime.UtcNow), new TcxFootballCoreMetrics(false, "Core metrics unavailable.", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new Dictionary<string, TcxMetricAvailability>(), new Dictionary<string, string>()), Array.Empty<TcxIntervalAggregate>());
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
            return new TcxActivitySummary(null, null, 0, null, null, null, null, false, null, "NotAvailable", "Low", new List<string> { "TCX summary unavailable due to invalid stored content." }, new TcxDataAvailability("NotAvailable", "NotMeasured", "GPS not present in this session.", "NotMeasured", "Heart-rate data not present in this session.", "Low", new List<string> { "No GPS quality assessment available." }, "Low", new List<string> { "No heart-rate quality assessment available." }), Array.Empty<TcxGpsTrackpoint>(), new TcxSmoothingTrace("NotAvailable", new Dictionary<string, string>(), null, null, 0, 0, 0, 0, 0, 0, "NotAvailable", DateTime.UtcNow), new TcxFootballCoreMetrics(false, "Core metrics unavailable.", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new Dictionary<string, TcxMetricAvailability>(), new Dictionary<string, string>()), Array.Empty<TcxIntervalAggregate>());
        }
    }


    private static TcxDataAvailability BuildDataAvailabilityFromSummary(TcxActivitySummary summary)
    {
        var hasGpsData = summary.HasGpsData;
        var hasHeartRateData = summary.HeartRateAverageBpm.HasValue || summary.HeartRateMinBpm.HasValue || summary.HeartRateMaxBpm.HasValue;

        var gpsQualityStatus = summary.DataAvailability?.GpsQualityStatus ?? summary.QualityStatus;
        var heartRateQualityStatus = summary.DataAvailability?.HeartRateQualityStatus ?? summary.QualityStatus;

        var gpsStatus = hasGpsData
            ? (string.Equals(gpsQualityStatus, "Low", StringComparison.OrdinalIgnoreCase)
                ? "NotUsable"
                : string.Equals(gpsQualityStatus, "Medium", StringComparison.OrdinalIgnoreCase)
                    ? "AvailableWithWarning"
                    : "Available")
            : "NotMeasured";
        var gpsReason = gpsStatus switch
        {
            "NotMeasured" => "GPS not present in this session.",
            "NotUsable" => $"GPS unusable because GPS-channel quality is {gpsQualityStatus}.",
            "AvailableWithWarning" => $"GPS available with warning because GPS-channel quality is {gpsQualityStatus}.",
            _ => null
        };

        var heartRateStatus = hasHeartRateData
            ? (string.Equals(heartRateQualityStatus, "Low", StringComparison.OrdinalIgnoreCase)
                ? "NotUsable"
                : string.Equals(heartRateQualityStatus, "Medium", StringComparison.OrdinalIgnoreCase)
                    ? "AvailableWithWarning"
                    : "Available")
            : "NotMeasured";
        var heartRateReason = heartRateStatus switch
        {
            "NotMeasured" => "Heart-rate data not present in this session.",
            "NotUsable" => $"Heart-rate data unusable because HR-channel quality is {heartRateQualityStatus}.",
            "AvailableWithWarning" => $"Heart-rate data available with warning because HR-channel quality is {heartRateQualityStatus}.",
            _ => null
        };

        var mode = (hasGpsData, hasHeartRateData) switch
        {
            (true, true) => "Dual",
            (true, false) => "GpsOnly",
            (false, true) => "HeartRateOnly",
            _ => "NotAvailable"
        };

        return new TcxDataAvailability(mode, gpsStatus, gpsReason, heartRateStatus, heartRateReason, gpsQualityStatus, summary.DataAvailability?.GpsQualityReasons ?? new List<string>(), heartRateQualityStatus, summary.DataAvailability?.HeartRateQualityReasons ?? new List<string>());
    }

    private static TcxActivitySummary EnsureDataAvailability(TcxActivitySummary summary)
        => summary.DataAvailability is null
            ? summary with { DataAvailability = BuildDataAvailabilityFromSummary(summary) }
            : summary;


    public TcxActivitySummary ResolveSummary(TcxUpload upload)
    {
        if (!string.IsNullOrWhiteSpace(upload.SessionSummarySnapshotJson))
        {
            var deserialized = JsonSerializer.Deserialize<TcxActivitySummary>(upload.SessionSummarySnapshotJson);
            if (deserialized is not null)
            {
                return EnsureDataAvailability(deserialized);
            }
        }

        return CreateSummaryFromRawContent(upload.RawFileContent, upload.SelectedSmoothingFilter, upload.MetricThresholdSnapshotJson);
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

    public IReadOnlyList<TcxSessionSegment> ResolveSegments(TcxUpload upload)
    {
        var parsed = string.IsNullOrWhiteSpace(upload.SegmentsSnapshotJson)
            ? new List<TcxSessionSegment>()
            : (JsonSerializer.Deserialize<List<TcxSessionSegment>>(upload.SegmentsSnapshotJson) ?? new List<TcxSessionSegment>())
                .Select(segment => segment with { Category = NormalizeSegmentCategory(segment.Category) })
                .ToList();

        if (parsed.Count > 0)
        {
            return parsed;
        }

        var summary = ResolveSummary(upload);
        var defaultEnd = Math.Max(2, (int)Math.Round(summary.DurationSeconds ?? 0d));
        return new[]
        {
            new TcxSessionSegment(CreateDefaultSegmentId(upload.Id), "Gesamte Session", 0, defaultEnd, "Other")
        };
    }

    public IReadOnlyList<TcxSegmentChangeEntry> ResolveSegmentChangeHistory(TcxUpload upload)
    {
        if (string.IsNullOrWhiteSpace(upload.SegmentChangeHistoryJson))
        {
            return Array.Empty<TcxSegmentChangeEntry>();
        }

        return JsonSerializer.Deserialize<List<TcxSegmentChangeEntry>>(upload.SegmentChangeHistoryJson)
            ?? new List<TcxSegmentChangeEntry>();
    }

    private async Task RefreshAdaptiveStatsAsync(TcxUpload upload, CancellationToken cancellationToken)
    {
        var summary = ResolveSummary(upload);
        await _repository.UpsertAdaptiveStatsAsync(upload.Id, summary.CoreMetrics.MaxSpeedMetersPerSecond, summary.HeartRateMaxBpm, DateTime.UtcNow, cancellationToken);
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

    private static string NormalizeSegmentLabel(string value)
        => value.Trim();

    private static readonly HashSet<string> AllowedSegmentCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "Other",
        "Aufwärmen",
        "Spielform",
        "Torschuss",
        "Athletik",
        "Cooldown"
    };

    private static string NormalizeSegmentCategory(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "Other";
        }

        var normalized = value.Trim();
        return AllowedSegmentCategories.FirstOrDefault(category => string.Equals(category, normalized, StringComparison.OrdinalIgnoreCase)) ?? "Other";
    }

    private static Guid CreateDefaultSegmentId(Guid uploadId)
    {
        var bytes = uploadId.ToByteArray();
        bytes[0] ^= 0x5A;
        bytes[15] ^= 0xA5;
        return new Guid(bytes);
    }

    private static bool IsSyntheticDefaultOnly(IReadOnlyList<TcxSessionSegment> segments, Guid uploadId)
        => segments.Count == 1 && segments[0].Id == CreateDefaultSegmentId(uploadId);

    private static void ValidateSegmentRange(int startSecond, int endSecond)
    {
        if (startSecond < 0 || endSecond < 0 || endSecond <= startSecond)
        {
            throw new InvalidDataException("Segment boundaries must be positive and EndSecond must be greater than StartSecond.");
        }
    }

    private static void EnsureNoInvalidOverlap(IReadOnlyCollection<TcxSessionSegment> segments, int startSecond, int endSecond, Guid? excludedSegmentId)
    {
        var hasOverlap = segments.Any(segment =>
            (!excludedSegmentId.HasValue || segment.Id != excludedSegmentId.Value)
            && startSecond < segment.EndSecond
            && endSecond > segment.StartSecond);

        if (hasOverlap)
        {
            throw new InvalidDataException("Segments must not overlap.");
        }
    }

    private IReadOnlyList<TcxSegmentChangeEntry> AppendSegmentHistory(TcxUpload upload, string action, string? notes, IReadOnlyList<TcxSessionSegment> segmentsSnapshot)
    {
        var history = ResolveSegmentChangeHistory(upload).ToList();
        var nextVersion = history.Count == 0 ? 1 : history[^1].Version + 1;
        history.Add(new TcxSegmentChangeEntry(nextVersion, DateTime.UtcNow, action, string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(), segmentsSnapshot.ToArray()));
        return history;
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
