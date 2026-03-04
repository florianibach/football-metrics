using FootballMetrics.Api.Api.V1;
using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public interface ISessionComparisonService
{
    SessionComparisonContextDto BuildContext(
        TcxUpload selected,
        IReadOnlyList<TcxUpload> allUploads,
        int comparisonSessionsCount,
        Func<TcxUpload, TcxActivitySummary> summaryResolver,
        Func<TcxUpload, IReadOnlyList<TcxSessionSegment>> segmentResolver);
}

public class SessionComparisonService : ISessionComparisonService
{
    private static readonly int[] Windows = [1, 2, 5];

    public SessionComparisonContextDto BuildContext(
        TcxUpload selected,
        IReadOnlyList<TcxUpload> allUploads,
        int comparisonSessionsCount,
        Func<TcxUpload, TcxActivitySummary> summaryResolver,
        Func<TcxUpload, IReadOnlyList<TcxSessionSegment>> segmentResolver)
    {
        var normalizedCount = Math.Clamp(comparisonSessionsCount, 1, 20);
        var sessionTypePool = allUploads
            .Where(upload => string.Equals(upload.SessionType, selected.SessionType, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(upload => summaryResolver(upload).ActivityStartTimeUtc ?? upload.UploadedAtUtc)
            .Take(normalizedCount)
            .ToList();

        var overview = new Dictionary<string, ComparisonMetricDto>
        {
            ["distanceMeters"] = BuildMetric(sessionTypePool, u => summaryResolver(u).CoreMetrics.DistanceMeters),
            ["durationSeconds"] = BuildMetric(sessionTypePool, u => summaryResolver(u).DurationSeconds),
            ["runningDensityMetersPerMinute"] = BuildMetric(sessionTypePool, u => summaryResolver(u).CoreMetrics.RunningDensityMetersPerMinute),
            ["maxSpeedMetersPerSecond"] = BuildMetric(sessionTypePool, u => summaryResolver(u).CoreMetrics.MaxSpeedMetersPerSecond),
            ["highSpeedDistanceMeters"] = BuildMetric(sessionTypePool, u => summaryResolver(u).CoreMetrics.HighSpeedDistanceMeters),
            ["heartRateAverageBpm"] = BuildMetric(sessionTypePool, u => summaryResolver(u).HeartRateAverageBpm),
            ["trainingImpulseEdwards"] = BuildMetric(sessionTypePool, u => summaryResolver(u).CoreMetrics.TrainingImpulseEdwards),
            ["heartRateRecoveryAfter60Seconds"] = BuildMetric(sessionTypePool, u => summaryResolver(u).CoreMetrics.HeartRateRecoveryAfter60Seconds)
        };

        var peak = new Dictionary<string, IReadOnlyDictionary<int, ComparisonMetricDto>>
        {
            ["distance"] = BuildPeakMetrics(sessionTypePool, s => ComputePeakDistance(s, 0, null)),
            ["highSpeedDistance"] = BuildPeakMetrics(sessionTypePool, s => ComputePeakDistance(s, 1, null)),
            ["mechanicalLoad"] = BuildPeakMetrics(sessionTypePool, s => ComputePeakMechanical(s, null)),
            ["trimp"] = BuildPeakMetrics(sessionTypePool, s => ComputePeakTrimp(s, null)),
            ["heartRateAvg"] = BuildPeakMetrics(sessionTypePool, s => ComputePeakHeartRate(s, null))
        };

        var segmentEntries = sessionTypePool
            .SelectMany(upload => segmentResolver(upload)
                .Where(segment => !string.Equals(segment.Category, "Other", StringComparison.OrdinalIgnoreCase))
                .Select(segment => (upload, segment)))
            .ToList();

        var categories = segmentEntries
            .Select(entry => entry.segment.Category)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(category => category)
            .ToList();

        var segmentOverviewByCategory = categories.ToDictionary(
            category => category,
            category => (IReadOnlyDictionary<string, ComparisonMetricDto>)BuildSegmentOverview(segmentEntries.Where(entry => string.Equals(entry.segment.Category, category, StringComparison.OrdinalIgnoreCase)).ToList()),
            StringComparer.OrdinalIgnoreCase);

        var segmentPeakByCategory = categories.ToDictionary(
            category => category,
            category => (IReadOnlyDictionary<string, IReadOnlyDictionary<int, ComparisonMetricDto>>)BuildSegmentPeak(segmentEntries.Where(entry => string.Equals(entry.segment.Category, category, StringComparison.OrdinalIgnoreCase)).ToList()),
            StringComparer.OrdinalIgnoreCase);

        return new SessionComparisonContextDto(
            normalizedCount,
            selected.SessionType,
            overview,
            peak,
            segmentOverviewByCategory,
            segmentPeakByCategory);
    }

    private static Dictionary<string, ComparisonMetricDto> BuildSegmentOverview(IReadOnlyList<(TcxUpload upload, TcxSessionSegment segment)> entries)
        => new()
        {
            ["distanceMeters"] = BuildMetric(entries, c => ComputeSegmentDistance(c.upload, c.segment)),
            ["durationSeconds"] = BuildMetric(entries, c => (double)(c.segment.EndSecond - c.segment.StartSecond)),
            ["runningDensityMetersPerMinute"] = BuildMetric(entries, c => ComputeSegmentRunningDensity(c.upload, c.segment)),
            ["maxSpeedMetersPerSecond"] = BuildMetric(entries, c => ComputeSegmentMaxSpeed(c.upload, c.segment)),
            ["highSpeedDistanceMeters"] = BuildMetric(entries, c => ComputeSegmentHighSpeedDistance(c.upload, c.segment)),
            ["heartRateAverageBpm"] = BuildMetric(entries, c => ComputeSegmentHeartRate(c.upload, c.segment)),
            ["trainingImpulseEdwards"] = BuildMetric(entries, c => ComputeSegmentTrimp(c.upload, c.segment)),
            ["heartRateRecoveryAfter60Seconds"] = new ComparisonMetricDto(null, null, false, "Not available for segments")
        };

    private static Dictionary<string, IReadOnlyDictionary<int, ComparisonMetricDto>> BuildSegmentPeak(IReadOnlyList<(TcxUpload upload, TcxSessionSegment segment)> entries)
        => new()
        {
            ["distance"] = BuildPeakMetrics(entries, c => ComputePeakDistance(c.upload, 0, (c.segment.StartSecond, c.segment.EndSecond))),
            ["highSpeedDistance"] = BuildPeakMetrics(entries, c => ComputePeakDistance(c.upload, 1, (c.segment.StartSecond, c.segment.EndSecond))),
            ["mechanicalLoad"] = BuildPeakMetrics(entries, c => ComputePeakMechanical(c.upload, (c.segment.StartSecond, c.segment.EndSecond))),
            ["trimp"] = BuildPeakMetrics(entries, c => ComputePeakTrimp(c.upload, (c.segment.StartSecond, c.segment.EndSecond))),
            ["heartRateAvg"] = BuildPeakMetrics(entries, c => ComputePeakHeartRate(c.upload, (c.segment.StartSecond, c.segment.EndSecond)))
        };

    private static IReadOnlyDictionary<int, ComparisonMetricDto> BuildPeakMetrics<T>(IReadOnlyList<T> source, Func<T, IReadOnlyDictionary<int, double?>> getter)
        => Windows.ToDictionary(window => window, window => BuildMetric(source, entry => getter(entry).TryGetValue(window, out var value) ? value : null));

    private static ComparisonMetricDto BuildMetric<T>(IReadOnlyList<T> source, Func<T, double?> selector)
    {
        var values = source.Select(selector).Where(v => v.HasValue).Select(v => v!.Value).ToList();
        return values.Count == 0
            ? new ComparisonMetricDto(null, null, false, "No comparable sessions available")
            : new ComparisonMetricDto(values.Average(), values.Max(), true, null);
    }

    private static double? ComputeSegmentDistance(TcxUpload upload, TcxSessionSegment segment)
        => SumDistance(GetSummary(upload), segment.StartSecond, segment.EndSecond, false);

    private static double? ComputeSegmentHighSpeedDistance(TcxUpload upload, TcxSessionSegment segment)
        => SumDistance(GetSummary(upload), segment.StartSecond, segment.EndSecond, true);

    private static double? ComputeSegmentRunningDensity(TcxUpload upload, TcxSessionSegment segment)
    {
        var distance = ComputeSegmentDistance(upload, segment);
        if (!distance.HasValue)
        {
            return null;
        }

        var durationMinutes = Math.Max(1d / 60d, (segment.EndSecond - segment.StartSecond) / 60d);
        return distance.Value / durationMinutes;
    }

    private static double? SumDistance(TcxActivitySummary summary, int start, int end, bool highSpeedOnly)
    {
        var points = summary.GpsTrackpoints.Where(p => p.ElapsedSeconds.HasValue).OrderBy(p => p.ElapsedSeconds).ToList();
        if (points.Count < 2)
        {
            return null;
        }

        var threshold = ParseThreshold(summary.CoreMetrics.Thresholds.TryGetValue("HighIntensitySpeedThresholdMps", out var raw) ? raw : null);
        double total = 0;

        for (var index = 1; index < points.Count; index++)
        {
            var prev = points[index - 1];
            var curr = points[index];
            var sec = (int)Math.Floor(curr.ElapsedSeconds!.Value);
            if (sec < start || sec > end)
            {
                continue;
            }

            var elapsed = curr.ElapsedSeconds.Value - prev.ElapsedSeconds!.Value;
            if (elapsed <= 0)
            {
                continue;
            }

            var distance = Haversine(prev, curr);
            if (!highSpeedOnly || (distance / elapsed) >= threshold)
            {
                total += distance;
            }
        }

        return total;
    }

    private static double ParseThreshold(string? raw)
        => double.TryParse(raw, out var value) && value > 0 ? value : 7d / 3.6d;

    private static double Haversine(TcxGpsTrackpoint first, TcxGpsTrackpoint second)
    {
        static double ToRadians(double value) => value * Math.PI / 180d;
        var dLat = ToRadians(second.Latitude - first.Latitude);
        var dLon = ToRadians(second.Longitude - first.Longitude);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(ToRadians(first.Latitude)) * Math.Cos(ToRadians(second.Latitude)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 6371000d * (2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a)));
    }

    private static double? ComputeSegmentMaxSpeed(TcxUpload upload, TcxSessionSegment segment)
    {
        var summary = GetSummary(upload);
        var points = summary.GpsTrackpoints.Where(p => p.ElapsedSeconds.HasValue).OrderBy(p => p.ElapsedSeconds).ToList();
        double max = 0;

        for (var index = 1; index < points.Count; index++)
        {
            var prev = points[index - 1];
            var curr = points[index];
            var sec = (int)Math.Floor(curr.ElapsedSeconds!.Value);
            if (sec < segment.StartSecond || sec > segment.EndSecond)
            {
                continue;
            }

            var elapsed = curr.ElapsedSeconds.Value - prev.ElapsedSeconds!.Value;
            if (elapsed <= 0)
            {
                continue;
            }

            max = Math.Max(max, Haversine(prev, curr) / elapsed);
        }

        return max > 0 ? max : null;
    }

    private static double? ComputeSegmentHeartRate(TcxUpload upload, TcxSessionSegment segment)
    {
        var summary = GetSummary(upload);
        var values = summary.HeartRateSamples
            .Where(sample => sample.ElapsedSeconds >= segment.StartSecond && sample.ElapsedSeconds <= segment.EndSecond)
            .Select(sample => (double)sample.HeartRateBpm)
            .ToList();
        return values.Count > 0 ? values.Average() : null;
    }

    private static double? ComputeSegmentTrimp(TcxUpload upload, TcxSessionSegment segment)
    {
        var avgHr = ComputeSegmentHeartRate(upload, segment);
        if (!avgHr.HasValue)
        {
            return null;
        }

        var minutes = Math.Max(1d / 60d, (segment.EndSecond - segment.StartSecond) / 60d);
        var zoneWeight = avgHr.Value < 120 ? 1 : avgHr.Value < 140 ? 2 : avgHr.Value < 160 ? 3 : avgHr.Value < 180 ? 4 : 5;
        return zoneWeight * minutes;
    }

    private static IReadOnlyDictionary<int, double?> ComputePeakDistance(TcxUpload upload, int mode, (int start, int end)? range)
    {
        var summary = GetSummary(upload);
        var output = new Dictionary<int, double?>();
        foreach (var window in Windows)
        {
            var values = summary.IntervalAggregates.Where(i => i.WindowMinutes == window && (!range.HasValue || (i.WindowIndex * 60) >= range.Value.start && (i.WindowIndex * 60) <= range.Value.end));
            output[window] = mode == 0
                ? values.MaxBy(v => v.CoreMetrics.DistanceMeters ?? 0)?.CoreMetrics.DistanceMeters
                : values.MaxBy(v => v.CoreMetrics.HighSpeedDistanceMeters ?? 0)?.CoreMetrics.HighSpeedDistanceMeters;
        }

        return output;
    }

    private static IReadOnlyDictionary<int, double?> ComputePeakMechanical(TcxUpload upload, (int start, int end)? range)
    {
        var summary = GetSummary(upload);
        var events = summary.Accelerations.Concat(summary.Decelerations).Concat(summary.HighIntensityDirectionChanges).ToList();
        var duration = (int)Math.Max(summary.DurationSeconds ?? 0, 1);
        var output = new Dictionary<int, double?>();

        foreach (var window in Windows)
        {
            var span = window * 60;
            var max = 0;
            for (var end = 0; end <= duration; end++)
            {
                if (range.HasValue && (end < range.Value.start || end > range.Value.end))
                {
                    continue;
                }

                var start = end - span;
                var count = events.Count(e => e.StartElapsedSeconds >= start && e.StartElapsedSeconds <= end);
                max = Math.Max(max, count);
            }

            output[window] = max > 0 ? max : null;
        }

        return output;
    }

    private static IReadOnlyDictionary<int, double?> ComputePeakTrimp(TcxUpload upload, (int start, int end)? range)
    {
        var summary = GetSummary(upload);
        var output = new Dictionary<int, double?>();
        foreach (var window in Windows)
        {
            var values = summary.IntervalAggregates
                .Where(i => i.WindowMinutes == window && (!range.HasValue || (i.WindowIndex * 60) >= range.Value.start && (i.WindowIndex * 60) <= range.Value.end))
                .Select(i => i.CoreMetrics.TrainingImpulseEdwards.HasValue ? i.CoreMetrics.TrainingImpulseEdwards.Value / window : (double?)null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();

            output[window] = values.Count > 0 ? values.Max() : null;
        }

        return output;
    }

    private static IReadOnlyDictionary<int, double?> ComputePeakHeartRate(TcxUpload upload, (int start, int end)? range)
    {
        var summary = GetSummary(upload);
        var samples = summary.HeartRateSamples.OrderBy(s => s.ElapsedSeconds).ToList();
        var duration = (int)Math.Max(summary.DurationSeconds ?? 0, 1);
        var output = new Dictionary<int, double?>();

        foreach (var window in Windows)
        {
            var span = window * 60;
            double? best = null;
            for (var end = 0; end <= duration; end++)
            {
                if (range.HasValue && (end < range.Value.start || end > range.Value.end))
                {
                    continue;
                }

                var start = end - span;
                var inWindow = samples
                    .Where(sample => sample.ElapsedSeconds >= start && sample.ElapsedSeconds <= end)
                    .Select(sample => (double)sample.HeartRateBpm)
                    .ToList();

                if (inWindow.Count == 0)
                {
                    continue;
                }

                var average = inWindow.Average();
                best = !best.HasValue || average > best.Value ? average : best;
            }

            output[window] = best;
        }

        return output;
    }

    private static TcxActivitySummary GetSummary(TcxUpload upload)
        => string.IsNullOrWhiteSpace(upload.SessionSummarySnapshotJson)
            ? throw new InvalidOperationException("Session summary snapshot is required for comparison precomputation.")
            : (System.Text.Json.JsonSerializer.Deserialize<TcxActivitySummary>(upload.SessionSummarySnapshotJson) ?? throw new InvalidOperationException("Invalid session summary snapshot."));
}
