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
        var sameType = allUploads
            .Where(upload => string.Equals(upload.SessionType, selected.SessionType, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(upload => summaryResolver(upload).ActivityStartTimeUtc ?? upload.UploadedAtUtc)
            .Take(normalizedCount)
            .ToList();

        var selectedSummary = summaryResolver(selected);
        var overview = new Dictionary<string, ComparisonMetricDto>
        {
            ["distanceMeters"] = BuildMetric(sameType, u => summaryResolver(u).CoreMetrics.DistanceMeters),
            ["durationSeconds"] = BuildMetric(sameType, u => summaryResolver(u).DurationSeconds),
            ["runningDensityMetersPerMinute"] = BuildMetric(sameType, u => summaryResolver(u).CoreMetrics.RunningDensityMetersPerMinute),
            ["maxSpeedMetersPerSecond"] = BuildMetric(sameType, u => summaryResolver(u).CoreMetrics.MaxSpeedMetersPerSecond),
            ["highSpeedDistanceMeters"] = BuildMetric(sameType, u => summaryResolver(u).CoreMetrics.HighSpeedDistanceMeters),
            ["heartRateAverageBpm"] = BuildMetric(sameType, u => summaryResolver(u).HeartRateAverageBpm),
            ["trainingImpulseEdwards"] = BuildMetric(sameType, u => summaryResolver(u).CoreMetrics.TrainingImpulseEdwards),
            ["heartRateRecoveryAfter60Seconds"] = BuildMetric(sameType, u => summaryResolver(u).CoreMetrics.HeartRateRecoveryAfter60Seconds)
        };

        var peak = new Dictionary<string, IReadOnlyDictionary<int, ComparisonMetricDto>>
        {
            ["distance"] = BuildPeakMetrics(sameType, s => ComputePeakDistance(summaryResolver(s), 0, null)),
            ["highSpeedDistance"] = BuildPeakMetrics(sameType, s => ComputePeakDistance(summaryResolver(s), 1, null)),
            ["mechanicalLoad"] = BuildPeakMetrics(sameType, s => ComputePeakMechanical(summaryResolver(s), null)),
            ["trimp"] = BuildPeakMetrics(sameType, s => ComputePeakTrimp(summaryResolver(s), null)),
            ["heartRateAvg"] = BuildPeakMetrics(sameType, s => ComputePeakHeartRate(summaryResolver(s), null))
        };

        var segments = segmentResolver(selected);
        var activeSegment = segments.FirstOrDefault();

        if (activeSegment is null || string.Equals(activeSegment.Category, "Other", StringComparison.OrdinalIgnoreCase))
        {
            return new SessionComparisonContextDto(normalizedCount, selected.SessionType, overview, peak, new Dictionary<string, ComparisonMetricDto>(), new Dictionary<string, IReadOnlyDictionary<int, ComparisonMetricDto>>(), activeSegment?.Category, "Segment category is not comparable.");
        }

        var segmentCandidates = sameType
            .SelectMany(upload => segmentResolver(upload).Select(segment => (upload, segment)))
            .Where(tuple => string.Equals(tuple.segment.Category, activeSegment.Category, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var segmentOverview = new Dictionary<string, ComparisonMetricDto>
        {
            ["distanceMeters"] = BuildMetric(segmentCandidates, c => ComputeSegmentDistance(summaryResolver(c.upload), c.segment)),
            ["durationSeconds"] = BuildMetric(segmentCandidates, c => (double)(c.segment.EndSecond - c.segment.StartSecond)),
            ["runningDensityMetersPerMinute"] = BuildMetric(segmentCandidates, c => ComputeSegmentRunningDensity(summaryResolver(c.upload), c.segment)),
            ["maxSpeedMetersPerSecond"] = BuildMetric(segmentCandidates, c => ComputeSegmentMaxSpeed(summaryResolver(c.upload), c.segment)),
            ["highSpeedDistanceMeters"] = BuildMetric(segmentCandidates, c => ComputeSegmentHighSpeedDistance(summaryResolver(c.upload), c.segment)),
            ["heartRateAverageBpm"] = BuildMetric(segmentCandidates, c => ComputeSegmentHeartRate(summaryResolver(c.upload), c.segment)),
            ["trainingImpulseEdwards"] = BuildMetric(segmentCandidates, c => ComputeSegmentTrimp(summaryResolver(c.upload), c.segment)),
            ["heartRateRecoveryAfter60Seconds"] = new ComparisonMetricDto(null, null, false, "Not available for segments")
        };

        var activeRange = (activeSegment.StartSecond, activeSegment.EndSecond);
        var segmentPeak = new Dictionary<string, IReadOnlyDictionary<int, ComparisonMetricDto>>
        {
            ["distance"] = BuildPeakMetrics(segmentCandidates, s => ComputePeakDistance(summaryResolver(s.upload), 0, (s.segment.StartSecond, s.segment.EndSecond))),
            ["highSpeedDistance"] = BuildPeakMetrics(segmentCandidates, s => ComputePeakDistance(summaryResolver(s.upload), 1, (s.segment.StartSecond, s.segment.EndSecond))),
            ["mechanicalLoad"] = BuildPeakMetrics(segmentCandidates, s => ComputePeakMechanical(summaryResolver(s.upload), (s.segment.StartSecond, s.segment.EndSecond))),
            ["trimp"] = BuildPeakMetrics(segmentCandidates, s => ComputePeakTrimp(summaryResolver(s.upload), (s.segment.StartSecond, s.segment.EndSecond))),
            ["heartRateAvg"] = BuildPeakMetrics(segmentCandidates, s => ComputePeakHeartRate(summaryResolver(s.upload), (s.segment.StartSecond, s.segment.EndSecond)))
        };

        return new SessionComparisonContextDto(normalizedCount, selected.SessionType, overview, peak, segmentOverview, segmentPeak, activeSegment.Category, segmentCandidates.Count == 0 ? "No matching segment category sessions available." : null);
    }

    private static IReadOnlyDictionary<int, ComparisonMetricDto> BuildPeakMetrics<T>(IReadOnlyList<T> source, Func<T, IReadOnlyDictionary<int, double?>> getter)
        => Windows.ToDictionary(w => w, w => BuildMetric(source, s => getter(s).TryGetValue(w, out var value) ? value : null));

    private static ComparisonMetricDto BuildMetric<T>(IReadOnlyList<T> source, Func<T, double?> selector)
    {
        var values = source.Select(selector).Where(v => v.HasValue).Select(v => v!.Value).ToList();
        if (values.Count == 0)
        {
            return new ComparisonMetricDto(null, null, false, "No comparable sessions available");
        }

        return new ComparisonMetricDto(values.Average(), values.Max(), true, null);
    }

    private static double? ComputeSegmentDistance(TcxActivitySummary summary, TcxSessionSegment segment)
        => SumDistance(summary, segment.StartSecond, segment.EndSecond, false);
    private static double? ComputeSegmentHighSpeedDistance(TcxActivitySummary summary, TcxSessionSegment segment)
        => SumDistance(summary, segment.StartSecond, segment.EndSecond, true);
    private static double? ComputeSegmentRunningDensity(TcxActivitySummary summary, TcxSessionSegment segment)
    {
        var durationMinutes = Math.Max(1d / 60d, (segment.EndSecond - segment.StartSecond) / 60d);
        var distance = ComputeSegmentDistance(summary, segment);
        return distance.HasValue ? distance.Value / durationMinutes : null;
    }

    private static double? SumDistance(TcxActivitySummary summary, int start, int end, bool highSpeedOnly)
    {
        var points = summary.GpsTrackpoints.Where(p => p.ElapsedSeconds.HasValue).OrderBy(p => p.ElapsedSeconds).ToList();
        if (points.Count < 2) return null;
        var threshold = ParseThreshold(summary.CoreMetrics.Thresholds.TryGetValue("HighIntensitySpeedThresholdMps", out var raw) ? raw : null);
        double total = 0;
        for (var i = 1; i < points.Count; i++)
        {
            var prev = points[i - 1];
            var curr = points[i];
            var sec = (int)Math.Floor(curr.ElapsedSeconds!.Value);
            if (sec < start || sec > end) continue;
            var elapsed = curr.ElapsedSeconds.Value - prev.ElapsedSeconds!.Value;
            if (elapsed <= 0) continue;
            var dist = Haversine(prev, curr);
            var speed = dist / elapsed;
            if (!highSpeedOnly || speed >= threshold)
            {
                total += dist;
            }
        }
        return total;
    }

    private static double ParseThreshold(string? raw)
        => double.TryParse(raw, out var value) && value > 0 ? value : 7d / 3.6d;

    private static double Haversine(TcxGpsTrackpoint first, TcxGpsTrackpoint second)
    {
        static double Rad(double degree) => degree * Math.PI / 180d;
        var dLat = Rad(second.Latitude - first.Latitude);
        var dLon = Rad(second.Longitude - first.Longitude);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(Rad(first.Latitude)) * Math.Cos(Rad(second.Latitude)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 6371000d * (2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a)));
    }

    private static double? ComputeSegmentMaxSpeed(TcxActivitySummary summary, TcxSessionSegment segment)
    {
        var points = summary.GpsTrackpoints.Where(p => p.ElapsedSeconds.HasValue).OrderBy(p => p.ElapsedSeconds).ToList();
        double max = 0;
        for (var i = 1; i < points.Count; i++)
        {
            var prev = points[i - 1];
            var curr = points[i];
            var sec = (int)Math.Floor(curr.ElapsedSeconds!.Value);
            if (sec < segment.StartSecond || sec > segment.EndSecond) continue;
            var elapsed = curr.ElapsedSeconds.Value - prev.ElapsedSeconds!.Value;
            if (elapsed <= 0) continue;
            max = Math.Max(max, Haversine(prev, curr) / elapsed);
        }
        return max > 0 ? max : null;
    }

    private static double? ComputeSegmentHeartRate(TcxActivitySummary summary, TcxSessionSegment segment)
    {
        var inRange = summary.HeartRateSamples.Where(s => s.ElapsedSeconds >= segment.StartSecond && s.ElapsedSeconds <= segment.EndSecond).Select(s => (double)s.HeartRateBpm).ToList();
        return inRange.Count > 0 ? inRange.Average() : null;
    }

    private static double? ComputeSegmentTrimp(TcxActivitySummary summary, TcxSessionSegment segment)
    {
        var avgHr = ComputeSegmentHeartRate(summary, segment);
        if (!avgHr.HasValue) return null;
        var minutes = Math.Max(1d / 60d, (segment.EndSecond - segment.StartSecond) / 60d);
        var zoneWeight = avgHr.Value < 120 ? 1 : avgHr.Value < 140 ? 2 : avgHr.Value < 160 ? 3 : avgHr.Value < 180 ? 4 : 5;
        return zoneWeight * minutes;
    }

    private static IReadOnlyDictionary<int, double?> ComputePeakDistance(TcxActivitySummary summary, int mode, (int start, int end)? range)
    {
        var output = new Dictionary<int, double?>();
        foreach (var w in Windows)
        {
            var values = summary.IntervalAggregates.Where(i => i.WindowMinutes == w && (!range.HasValue || (i.WindowIndex * 60) >= range.Value.start && (i.WindowIndex * 60) <= range.Value.end));
            output[w] = mode == 0
                ? values.MaxBy(v => v.CoreMetrics.DistanceMeters ?? 0)?.CoreMetrics.DistanceMeters
                : values.MaxBy(v => v.CoreMetrics.HighSpeedDistanceMeters ?? 0)?.CoreMetrics.HighSpeedDistanceMeters;
        }
        return output;
    }

    private static IReadOnlyDictionary<int, double?> ComputePeakMechanical(TcxActivitySummary summary, (int start, int end)? range)
    {
        var events = summary.Accelerations.Concat(summary.Decelerations).Concat(summary.HighIntensityDirectionChanges).ToList();
        var output = new Dictionary<int, double?>();
        foreach (var w in Windows)
        {
            var span = w * 60;
            var max = 0;
            for (var end = 0; end <= (int)Math.Max(summary.DurationSeconds ?? 0, 1); end++)
            {
                if (range.HasValue && (end < range.Value.start || end > range.Value.end)) continue;
                var start = end - span;
                var count = events.Count(e => e.StartElapsedSeconds >= start && e.StartElapsedSeconds <= end);
                max = Math.Max(max, count);
            }
            output[w] = max > 0 ? max : null;
        }
        return output;
    }

    private static IReadOnlyDictionary<int, double?> ComputePeakTrimp(TcxActivitySummary summary, (int start, int end)? range)
    {
        var output = new Dictionary<int, double?>();
        foreach (var w in Windows)
        {
            var values = summary.IntervalAggregates.Where(i => i.WindowMinutes == w && (!range.HasValue || (i.WindowIndex * 60) >= range.Value.start && (i.WindowIndex * 60) <= range.Value.end))
                .Select(i => i.CoreMetrics.TrainingImpulseEdwards.HasValue ? i.CoreMetrics.TrainingImpulseEdwards.Value / w : (double?)null)
                .Where(v => v.HasValue).Select(v => v!.Value).ToList();
            output[w] = values.Count > 0 ? values.Max() : null;
        }
        return output;
    }

    private static IReadOnlyDictionary<int, double?> ComputePeakHeartRate(TcxActivitySummary summary, (int start, int end)? range)
    {
        var samples = summary.HeartRateSamples.OrderBy(s => s.ElapsedSeconds).ToList();
        var output = new Dictionary<int, double?>();
        foreach (var w in Windows)
        {
            var span = w * 60;
            double? best = null;
            for (var end = 0; end <= (int)Math.Max(summary.DurationSeconds ?? 0, 1); end++)
            {
                if (range.HasValue && (end < range.Value.start || end > range.Value.end)) continue;
                var start = end - span;
                var inWindow = samples.Where(s => s.ElapsedSeconds >= start && s.ElapsedSeconds <= end).Select(s => (double)s.HeartRateBpm).ToList();
                if (inWindow.Count == 0) continue;
                var avg = inWindow.Average();
                best = !best.HasValue || avg > best.Value ? avg : best;
            }
            output[w] = best;
        }
        return output;
    }
}
