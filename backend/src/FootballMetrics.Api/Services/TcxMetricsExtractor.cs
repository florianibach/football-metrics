using System.Globalization;
using System.Xml.Linq;
using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public static partial class TcxMetricsExtractor
{
    private const double EarthRadiusMeters = 6_371_000;
    private const double MaxPlausibleSpeedMetersPerSecond = 12.5;
    private const double SprintSpeedThresholdMetersPerSecond = 7.0;
    private const double HighIntensitySpeedThresholdMetersPerSecond = 5.5;
    private const double AccelerationThresholdMetersPerSecondSquared = 2.0;
    private const double DecelerationThresholdMetersPerSecondSquared = -2.0;

    public static TcxActivitySummary Extract(XDocument document)
        => Extract(document, TcxSmoothingFilters.AdaptiveMedian, null);

    public static TcxActivitySummary Extract(XDocument document, string selectedSmoothingFilter)
        => Extract(document, selectedSmoothingFilter, null);

    public static TcxActivitySummary Extract(XDocument document, string selectedSmoothingFilter, MetricThresholdProfile? thresholdProfile)
    {
        var trackpoints = document
            .Descendants()
            .Where(node => string.Equals(node.Name.LocalName, "Trackpoint", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var startTime = ResolveStartTimeUtc(document, trackpoints);
        var durationSeconds = ResolveDurationSeconds(trackpoints);

        var trackpointSnapshots = trackpoints
            .Select(tp => new TrackpointSnapshot(
                ParseDateTime(tp.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "Time", StringComparison.OrdinalIgnoreCase))?.Value),
                ParseInt(tp.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "HeartRateBpm", StringComparison.OrdinalIgnoreCase))
                    ?.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "Value", StringComparison.OrdinalIgnoreCase))?.Value),
                ParseDouble(tp.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "Position", StringComparison.OrdinalIgnoreCase))
                    ?.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "LatitudeDegrees", StringComparison.OrdinalIgnoreCase))?.Value),
                ParseDouble(tp.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "Position", StringComparison.OrdinalIgnoreCase))
                    ?.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "LongitudeDegrees", StringComparison.OrdinalIgnoreCase))?.Value)))
            .ToList();

        var heartRates = trackpointSnapshots
            .Where(snapshot => snapshot.HeartRateBpm.HasValue)
            .Select(snapshot => snapshot.HeartRateBpm!.Value)
            .ToList();

        var rawGpsPoints = trackpointSnapshots
            .Where(snapshot => snapshot.Latitude.HasValue && snapshot.Longitude.HasValue)
            .Select(snapshot => (snapshot.Latitude!.Value, snapshot.Longitude!.Value))
            .ToList();

        var rawDistanceMeters = rawGpsPoints.Count < 2
            ? (double?)null
            : CalculateDistanceMeters(rawGpsPoints);

        var outlierSpeedThresholdMps = ResolveOutlierSpeedThresholdMetersPerSecond(trackpointSnapshots);
        var normalizedFilter = TcxSmoothingFilters.Supported.Contains(selectedSmoothingFilter)
            ? TcxSmoothingFilters.Supported.First(filter => string.Equals(filter, selectedSmoothingFilter, StringComparison.OrdinalIgnoreCase))
            : TcxSmoothingFilters.AdaptiveMedian;

        var smoothedTrackpoints = ApplySmoothingFilter(normalizedFilter, trackpointSnapshots, outlierSpeedThresholdMps, out var correctedOutlierCount);
        var smoothedGpsPoints = smoothedTrackpoints
            .Where(snapshot => snapshot.Latitude.HasValue && snapshot.Longitude.HasValue)
            .Select(snapshot => (snapshot.Latitude!.Value, snapshot.Longitude!.Value))
            .ToList();

        var smoothedDistanceMeters = smoothedGpsPoints.Count < 2
            ? rawDistanceMeters
            : CalculateDistanceMeters(smoothedGpsPoints);

        var fileDistanceMeters = document
            .Descendants()
            .Where(node => string.Equals(node.Name.LocalName, "DistanceMeters", StringComparison.OrdinalIgnoreCase))
            .Select(node => ParseDouble(node.Value))
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .DefaultIfEmpty()
            .Sum();

        var hasFileDistance = fileDistanceMeters > 0;
        var finalDistance = smoothedDistanceMeters ?? (hasFileDistance ? fileDistanceMeters : null);
        var source = smoothedDistanceMeters.HasValue ? "CalculatedFromGps" : (hasFileDistance ? "ProvidedByFile" : "NotAvailable");

        var qualityAssessment = AssessQuality(smoothedTrackpoints, outlierSpeedThresholdMps);
        var dataAvailability = BuildDataAvailability(rawGpsPoints.Count > 0, heartRates.Count > 0, qualityAssessment.Status);
        var smoothingTrace = BuildSmoothingTrace(normalizedFilter, trackpointSnapshots, smoothedTrackpoints, rawDistanceMeters, smoothedDistanceMeters, correctedOutlierCount, outlierSpeedThresholdMps);
        var effectiveThresholds = thresholdProfile ?? MetricThresholdProfile.CreateDefault();
        var coreMetrics = BuildFootballCoreMetrics(smoothedTrackpoints, qualityAssessment.Status, finalDistance, effectiveThresholds);
        var intervalAggregates = BuildIntervalAggregates(smoothedTrackpoints, effectiveThresholds);

        return new TcxActivitySummary(
            startTime,
            durationSeconds,
            trackpoints.Count,
            heartRates.Count == 0 ? null : heartRates.Min(),
            heartRates.Count == 0 ? null : (int?)Math.Round(heartRates.Average()),
            heartRates.Count == 0 ? null : heartRates.Max(),
            finalDistance,
            rawGpsPoints.Count > 0,
            hasFileDistance ? fileDistanceMeters : null,
            source,
            qualityAssessment.Status,
            qualityAssessment.Reasons,
            dataAvailability,
            smoothingTrace,
            coreMetrics,
            intervalAggregates);
    }


    private static TcxDataAvailability BuildDataAvailability(bool hasGpsData, bool hasHeartRateData, string qualityStatus)
    {
        var gpsStatus = hasGpsData
            ? (string.Equals(qualityStatus, "High", StringComparison.OrdinalIgnoreCase) ? "Available" : "NotUsable")
            : "NotMeasured";
        var gpsReason = gpsStatus switch
        {
            "NotMeasured" => "GPS not present in this session.",
            "NotUsable" => $"GPS unusable because quality is {qualityStatus}. Required: High.",
            _ => null
        };

        var heartRateStatus = hasHeartRateData ? "Available" : "NotMeasured";
        var heartRateReason = hasHeartRateData ? null : "Heart-rate data not present in this session.";

        var mode = (hasGpsData, hasHeartRateData) switch
        {
            (true, true) => "Dual",
            (true, false) => "GpsOnly",
            (false, true) => "HeartRateOnly",
            _ => "NotAvailable"
        };

        return new TcxDataAvailability(mode, gpsStatus, gpsReason, heartRateStatus, heartRateReason);
    }

    private static List<TrackpointSnapshot> ApplySmoothingFilter(
        string smoothingFilter,
        IReadOnlyList<TrackpointSnapshot> input,
        double outlierSpeedThresholdMps,
        out int correctedOutlierCount)
    {
        switch (smoothingFilter)
        {
            case TcxSmoothingFilters.Raw:
                correctedOutlierCount = 0;
                return input.Select(tp => tp with { }).ToList();
            case TcxSmoothingFilters.SavitzkyGolay:
                return ApplySavitzkyGolaySmoothing(input, out correctedOutlierCount);
            case TcxSmoothingFilters.Butterworth:
                return ApplyButterworthSmoothing(input, out correctedOutlierCount);
            default:
                return ApplyFootballAdaptiveSmoothing(input, outlierSpeedThresholdMps, out correctedOutlierCount);
        }
    }

    private static TcxSmoothingTrace BuildSmoothingTrace(
        string selectedStrategy,
        IReadOnlyList<TrackpointSnapshot> rawTrackpoints,
        IReadOnlyList<TrackpointSnapshot> smoothedTrackpoints,
        double? rawDistanceMeters,
        double? smoothedDistanceMeters,
        int correctedOutlierCount,
        double outlierSpeedThresholdMps)
    {
        var rawDirectionChanges = CountDirectionChanges(rawTrackpoints, 25);
        var baselineDirectionChanges = CountDirectionChanges(rawTrackpoints, 65);
        var smoothedDirectionChanges = CountDirectionChanges(smoothedTrackpoints, 25);

        var parameters = selectedStrategy switch
        {
            TcxSmoothingFilters.Raw => new Dictionary<string, string>
            {
                ["Mode"] = "NoSmoothing"
            },
            TcxSmoothingFilters.SavitzkyGolay => new Dictionary<string, string>
            {
                ["WindowSize"] = "5",
                ["PolynomialOrder"] = "2"
            },
            TcxSmoothingFilters.Butterworth => new Dictionary<string, string>
            {
                ["Alpha"] = "0.35",
                ["Type"] = "FirstOrderLowPass"
            },
            _ => new Dictionary<string, string>
            {
                ["AdaptiveTurnThresholdDegrees"] = "25",
                ["BaseWindowSize"] = "5",
                ["SharpTurnWindowSize"] = "3",
                ["OutlierDetectionMode"] = "AdaptiveMadWithAbsoluteCap",
                ["AbsoluteSpeedCapMps"] = "12.5",
                ["EffectiveOutlierSpeedThresholdMps"] = outlierSpeedThresholdMps.ToString("0.###", CultureInfo.InvariantCulture)
            }
        };

        return new TcxSmoothingTrace(
            selectedStrategy,
            parameters,
            rawDistanceMeters,
            smoothedDistanceMeters,
            rawDirectionChanges,
            baselineDirectionChanges,
            smoothedDirectionChanges,
            correctedOutlierCount,
            DateTime.UtcNow);
    }

    private static List<TrackpointSnapshot> ApplySavitzkyGolaySmoothing(
        IReadOnlyList<TrackpointSnapshot> input,
        out int correctedOutlierCount)
    {
        correctedOutlierCount = 0;
        if (input.Count < 5)
        {
            return input.Select(tp => tp with { }).ToList();
        }

        var output = input.Select(tp => tp with { }).ToList();
        var coefficients = new[] { -3d, 12d, 17d, 12d, -3d };
        const double denominator = 35d;

        for (var index = 2; index < input.Count - 2; index++)
        {
            var window = input.Skip(index - 2).Take(5).ToList();
            if (window.Any(point => !HasGps(point)))
            {
                continue;
            }

            var latitude = 0d;
            var longitude = 0d;
            for (var c = 0; c < coefficients.Length; c++)
            {
                latitude += coefficients[c] * window[c].Latitude!.Value;
                longitude += coefficients[c] * window[c].Longitude!.Value;
            }

            output[index] = output[index] with
            {
                Latitude = latitude / denominator,
                Longitude = longitude / denominator
            };
            correctedOutlierCount++;
        }

        return output;
    }

    private static List<TrackpointSnapshot> ApplyButterworthSmoothing(
        IReadOnlyList<TrackpointSnapshot> input,
        out int correctedOutlierCount)
    {
        correctedOutlierCount = 0;
        if (input.Count < 3)
        {
            return input.Select(tp => tp with { }).ToList();
        }

        var output = input.Select(tp => tp with { }).ToList();
        const double alpha = 0.35;

        for (var index = 1; index < output.Count; index++)
        {
            var previous = output[index - 1];
            var current = output[index];
            if (!HasGps(previous) || !HasGps(current))
            {
                continue;
            }

            output[index] = current with
            {
                Latitude = (alpha * current.Latitude!.Value) + ((1 - alpha) * previous.Latitude!.Value),
                Longitude = (alpha * current.Longitude!.Value) + ((1 - alpha) * previous.Longitude!.Value)
            };
            correctedOutlierCount++;
        }

        return output;
    }

    private static List<TrackpointSnapshot> ApplyFootballAdaptiveSmoothing(
        IReadOnlyList<TrackpointSnapshot> input,
        double outlierSpeedThresholdMps,
        out int correctedOutlierCount)
    {
        correctedOutlierCount = 0;
        if (input.Count < 3)
        {
            return input.ToList();
        }

        var output = input.Select(tp => tp with { }).ToList();

        for (var index = 1; index < input.Count - 1; index++)
        {
            var previous = output[index - 1];
            var current = output[index];
            var next = output[index + 1];

            if (!HasGps(previous) || !HasGps(current) || !HasGps(next) || !HasTimestamp(previous) || !HasTimestamp(current) || !HasTimestamp(next))
            {
                continue;
            }

            var incomingBearing = CalculateBearingDegrees(previous, current);
            var outgoingBearing = CalculateBearingDegrees(current, next);
            var turnAngle = CalculateTurnDeltaDegrees(incomingBearing, outgoingBearing);

            var distanceToCurrent = HaversineMeters((previous.Latitude!.Value, previous.Longitude!.Value), (current.Latitude!.Value, current.Longitude!.Value));
            var elapsedToCurrent = (current.TimeUtc!.Value - previous.TimeUtc!.Value).TotalSeconds;
            var speedToCurrent = elapsedToCurrent <= 0 ? 0 : distanceToCurrent / elapsedToCurrent;

            var isSpeedOutlier = speedToCurrent > outlierSpeedThresholdMps;
            var preserveLocalTurn = turnAngle >= 25;

            if (!isSpeedOutlier && preserveLocalTurn)
            {
                continue;
            }

            var windowRadius = preserveLocalTurn ? 1 : 2;
            var window = CollectWindow(output, index, windowRadius)
                .Where(HasGps)
                .ToList();

            if (window.Count < 3)
            {
                continue;
            }

            var smoothedLatitude = Median(window.Select(point => point.Latitude!.Value));
            var smoothedLongitude = Median(window.Select(point => point.Longitude!.Value));

            if (isSpeedOutlier)
            {
                correctedOutlierCount++;
            }

            output[index] = current with
            {
                Latitude = smoothedLatitude,
                Longitude = smoothedLongitude
            };
        }

        return output;
    }

    private static IEnumerable<TrackpointSnapshot> CollectWindow(IReadOnlyList<TrackpointSnapshot> points, int centerIndex, int radius)
    {
        var start = Math.Max(0, centerIndex - radius);
        var end = Math.Min(points.Count - 1, centerIndex + radius);

        for (var index = start; index <= end; index++)
        {
            yield return points[index];
        }
    }

    private static bool HasGps(TrackpointSnapshot point)
        => point.Latitude.HasValue && point.Longitude.HasValue;

    private static bool HasTimestamp(TrackpointSnapshot point)
        => point.TimeUtc.HasValue;

    private static double Median(IEnumerable<double> values)
    {
        var ordered = values.OrderBy(value => value).ToArray();
        if (ordered.Length == 0)
        {
            return 0;
        }

        var middle = ordered.Length / 2;
        if (ordered.Length % 2 == 0)
        {
            return (ordered[middle - 1] + ordered[middle]) / 2;
        }

        return ordered[middle];
    }

    private static int CountDirectionChanges(IReadOnlyList<TrackpointSnapshot> points, double thresholdDegrees)
    {
        var pointsWithGps = points
            .Where(point => HasGps(point))
            .ToList();

        if (pointsWithGps.Count < 3)
        {
            return 0;
        }

        var changes = 0;

        for (var index = 1; index < pointsWithGps.Count - 1; index++)
        {
            var incoming = CalculateBearingDegrees(pointsWithGps[index - 1], pointsWithGps[index]);
            var outgoing = CalculateBearingDegrees(pointsWithGps[index], pointsWithGps[index + 1]);
            var turn = CalculateTurnDeltaDegrees(incoming, outgoing);

            if (turn >= thresholdDegrees)
            {
                changes++;
            }
        }

        return changes;
    }

    private static double CalculateBearingDegrees(TrackpointSnapshot from, TrackpointSnapshot to)
    {
        var lat1 = DegreesToRadians(from.Latitude!.Value);
        var lat2 = DegreesToRadians(to.Latitude!.Value);
        var deltaLon = DegreesToRadians(to.Longitude!.Value - from.Longitude!.Value);

        var y = Math.Sin(deltaLon) * Math.Cos(lat2);
        var x = Math.Cos(lat1) * Math.Sin(lat2) - Math.Sin(lat1) * Math.Cos(lat2) * Math.Cos(deltaLon);
        var bearing = Math.Atan2(y, x) * 180 / Math.PI;

        return (bearing + 360) % 360;
    }

    private static double CalculateTurnDeltaDegrees(double firstBearing, double secondBearing)
    {
        var diff = Math.Abs(secondBearing - firstBearing) % 360;
        return diff > 180 ? 360 - diff : diff;
    }


    private static double ResolveOutlierSpeedThresholdMetersPerSecond(IReadOnlyList<TrackpointSnapshot> trackpoints)
    {
        var segmentSpeeds = trackpoints
            .Where(tp => tp.TimeUtc.HasValue && tp.Latitude.HasValue && tp.Longitude.HasValue)
            .OrderBy(tp => tp.TimeUtc)
            .Zip(trackpoints
                    .Where(tp => tp.TimeUtc.HasValue && tp.Latitude.HasValue && tp.Longitude.HasValue)
                    .OrderBy(tp => tp.TimeUtc)
                    .Skip(1),
                (previous, current) => new { previous, current })
            .Select(pair =>
            {
                var elapsedSeconds = (pair.current.TimeUtc!.Value - pair.previous.TimeUtc!.Value).TotalSeconds;
                if (elapsedSeconds <= 0)
                {
                    return (double?)null;
                }

                var distanceMeters = HaversineMeters(
                    (pair.previous.Latitude!.Value, pair.previous.Longitude!.Value),
                    (pair.current.Latitude!.Value, pair.current.Longitude!.Value));

                return distanceMeters / elapsedSeconds;
            })
            .Where(speed => speed.HasValue)
            .Select(speed => speed!.Value)
            .ToList();

        if (segmentSpeeds.Count == 0)
        {
            return MaxPlausibleSpeedMetersPerSecond;
        }

        var medianSpeed = Median(segmentSpeeds);
        var mad = Median(segmentSpeeds.Select(speed => Math.Abs(speed - medianSpeed)));
        var robustUpperBound = medianSpeed + (6 * 1.4826 * mad);

        return Math.Clamp(robustUpperBound, 6.0, MaxPlausibleSpeedMetersPerSecond);
    }


    private static IReadOnlyList<TcxIntervalAggregate> BuildIntervalAggregates(
        IReadOnlyList<TrackpointSnapshot> smoothedTrackpoints,
        MetricThresholdProfile thresholdsProfile)
    {
        var pointsWithTime = smoothedTrackpoints
            .Where(tp => tp.TimeUtc.HasValue)
            .OrderBy(tp => tp.TimeUtc)
            .ToList();

        if (pointsWithTime.Count < 2)
        {
            return Array.Empty<TcxIntervalAggregate>();
        }

        var aggregates = new List<TcxIntervalAggregate>();
        foreach (var windowMinutes in new[] { 1, 2, 5 })
        {
                aggregates.AddRange(BuildWindowAggregates(pointsWithTime, windowMinutes, thresholdsProfile));
        }

        return aggregates;
    }

    private static IEnumerable<TcxIntervalAggregate> BuildWindowAggregates(
        IReadOnlyList<TrackpointSnapshot> orderedPoints,
        int windowMinutes,
        MetricThresholdProfile thresholdsProfile)
    {
        var windowDurationSeconds = windowMinutes * 60d;
        var startTime = orderedPoints[0].TimeUtc!.Value;
        var endTime = orderedPoints[^1].TimeUtc!.Value;
        var totalWindows = Math.Max(1, (int)Math.Ceiling((endTime - startTime).TotalSeconds / windowDurationSeconds));

        for (var windowIndex = 0; windowIndex < totalWindows; windowIndex++)
        {
            var windowStart = startTime.AddSeconds(windowDurationSeconds * windowIndex);
            var windowEnd = windowStart.AddSeconds(windowDurationSeconds);

            var distanceMeters = 0d;
            var coveredSeconds = 0d;

            for (var pointIndex = 1; pointIndex < orderedPoints.Count; pointIndex++)
            {
                var previous = orderedPoints[pointIndex - 1];
                var current = orderedPoints[pointIndex];
                if (!previous.TimeUtc.HasValue || !current.TimeUtc.HasValue)
                {
                    continue;
                }

                var segmentStart = previous.TimeUtc.Value;
                var segmentEnd = current.TimeUtc.Value;
                if (segmentEnd <= segmentStart)
                {
                    continue;
                }

                var overlapStart = segmentStart > windowStart ? segmentStart : windowStart;
                var overlapEnd = segmentEnd < windowEnd ? segmentEnd : windowEnd;
                if (overlapEnd <= overlapStart)
                {
                    continue;
                }

                var overlapSeconds = (overlapEnd - overlapStart).TotalSeconds;
                var segmentSeconds = (segmentEnd - segmentStart).TotalSeconds;
                if (segmentSeconds <= 0)
                {
                    continue;
                }

                coveredSeconds += overlapSeconds;

                if (HasGps(previous) && HasGps(current))
                {
                    var segmentDistance = HaversineMeters((previous.Latitude!.Value, previous.Longitude!.Value), (current.Latitude!.Value, current.Longitude!.Value));
                    distanceMeters += segmentDistance * (overlapSeconds / segmentSeconds);
                }

            }

            var remainingWindowSeconds = Math.Max(0d, (endTime - windowStart).TotalSeconds);
            var windowDurationForDisplaySeconds = Math.Min(windowDurationSeconds, remainingWindowSeconds);

            var windowTrackpoints = orderedPoints
                .Where(point => point.TimeUtc.HasValue && point.TimeUtc.Value >= windowStart && point.TimeUtc.Value <= windowEnd)
                .ToList();

            var intervalCoreMetrics = BuildFootballCoreMetrics(
                windowTrackpoints,
                "High",
                coveredSeconds > 0 ? distanceMeters : null,
                thresholdsProfile);

            yield return new TcxIntervalAggregate(
                windowMinutes,
                windowIndex,
                windowStart,
                windowDurationForDisplaySeconds,
                intervalCoreMetrics);
        }
    }
    private static QualityAssessment AssessQuality(IReadOnlyList<TrackpointSnapshot> trackpoints, double outlierSpeedThresholdMps)
    {
        if (trackpoints.Count == 0)
        {
            return new QualityAssessment("Low", new List<string> { "No trackpoints found in TCX file." });
        }

        var reasons = new List<string>();
        var penaltyPoints = 0;

        var missingTimestampCount = trackpoints.Count(tp => !tp.TimeUtc.HasValue);
        var missingGpsCount = trackpoints.Count(tp => !tp.Latitude.HasValue || !tp.Longitude.HasValue);
        var missingHeartRateCount = trackpoints.Count(tp => !tp.HeartRateBpm.HasValue);

        var missingTimestampRatio = (double)missingTimestampCount / trackpoints.Count;
        var missingGpsRatio = (double)missingGpsCount / trackpoints.Count;
        var missingHeartRateRatio = (double)missingHeartRateCount / trackpoints.Count;

        if (missingTimestampRatio > 0.5)
        {
            penaltyPoints += 2;
            reasons.Add($"Many trackpoints are missing timestamps ({missingTimestampCount}/{trackpoints.Count}).");
        }
        else if (missingTimestampRatio > 0.1)
        {
            penaltyPoints += 1;
            reasons.Add($"Some trackpoints are missing timestamps ({missingTimestampCount}/{trackpoints.Count}).");
        }

        if (missingGpsRatio > 0.5)
        {
            penaltyPoints += 2;
            reasons.Add($"GPS coverage is limited ({trackpoints.Count - missingGpsCount}/{trackpoints.Count} points with coordinates).");
        }
        else if (missingGpsRatio > 0.1)
        {
            penaltyPoints += 1;
            reasons.Add($"GPS data is partially missing ({trackpoints.Count - missingGpsCount}/{trackpoints.Count} points with coordinates).");
        }

        if (missingHeartRateRatio > 0.5)
        {
            penaltyPoints += 2;
            reasons.Add($"Heart rate data is mostly missing ({trackpoints.Count - missingHeartRateCount}/{trackpoints.Count} points with heart rate).");
        }
        else if (missingHeartRateRatio > 0.1)
        {
            penaltyPoints += 1;
            reasons.Add($"Heart rate data is partially missing ({trackpoints.Count - missingHeartRateCount}/{trackpoints.Count} points with heart rate).");
        }

        var unplausibleJumpCount = CountUnplausibleGpsJumps(trackpoints, outlierSpeedThresholdMps);
        if (unplausibleJumpCount >= 2)
        {
            penaltyPoints += 2;
            reasons.Add($"Detected multiple implausible GPS jumps ({unplausibleJumpCount}).");
        }
        else if (unplausibleJumpCount > 0)
        {
            penaltyPoints += 1;
            reasons.Add($"Detected isolated implausible GPS jumps ({unplausibleJumpCount}).");
        }

        var status = penaltyPoints >= 4
            ? "Low"
            : penaltyPoints >= 2
                ? "Medium"
                : "High";

        if (reasons.Count == 0)
        {
            reasons.Add("Trackpoints are complete with GPS and heart rate data. No implausible jumps detected.");
        }

        return new QualityAssessment(status, reasons);
    }

    private static TcxFootballCoreMetrics BuildFootballCoreMetrics(
        IReadOnlyList<TrackpointSnapshot> trackpoints,
        string qualityStatus,
        double? totalDistanceMeters,
        MetricThresholdProfile thresholdsProfile)
    {
        var thresholds = new Dictionary<string, string>
        {
            ["MaxSpeedMps"] = thresholdsProfile.MaxSpeedMps.ToString("0.0", CultureInfo.InvariantCulture),
            ["MaxSpeedMode"] = thresholdsProfile.MaxSpeedMode,
            ["MaxSpeedEffectiveMps"] = thresholdsProfile.EffectiveMaxSpeedMps.ToString("0.0", CultureInfo.InvariantCulture),
            ["MaxSpeedSource"] = string.Equals(thresholdsProfile.MaxSpeedMode, MetricThresholdModes.Adaptive, StringComparison.OrdinalIgnoreCase) ? "Adaptive" : "Fixed",
            ["SprintSpeedPercentOfMaxSpeed"] = thresholdsProfile.SprintSpeedPercentOfMaxSpeed.ToString("0.0", CultureInfo.InvariantCulture),
            ["SprintSpeedThresholdMps"] = (thresholdsProfile.EffectiveMaxSpeedMps * (thresholdsProfile.SprintSpeedPercentOfMaxSpeed / 100.0)).ToString("0.0", CultureInfo.InvariantCulture),
            ["HighIntensitySpeedPercentOfMaxSpeed"] = thresholdsProfile.HighIntensitySpeedPercentOfMaxSpeed.ToString("0.0", CultureInfo.InvariantCulture),
            ["HighIntensitySpeedThresholdMps"] = (thresholdsProfile.EffectiveMaxSpeedMps * (thresholdsProfile.HighIntensitySpeedPercentOfMaxSpeed / 100.0)).ToString("0.0", CultureInfo.InvariantCulture),
            ["AccelerationThresholdMps2"] = thresholdsProfile.AccelerationThresholdMps2.ToString("0.0", CultureInfo.InvariantCulture),
            ["AccelerationThresholdMode"] = "Fixed",
            ["AccelerationThresholdSource"] = "Fixed",
            ["DecelerationThresholdMps2"] = thresholdsProfile.DecelerationThresholdMps2.ToString("0.0", CultureInfo.InvariantCulture),
            ["DecelerationThresholdMode"] = "Fixed",
            ["DecelerationThresholdSource"] = "Fixed",
            ["MaxHeartRateBpm"] = thresholdsProfile.MaxHeartRateBpm.ToString(CultureInfo.InvariantCulture),
            ["MaxHeartRateMode"] = thresholdsProfile.MaxHeartRateMode,
            ["MaxHeartRateEffectiveBpm"] = thresholdsProfile.EffectiveMaxHeartRateBpm.ToString(CultureInfo.InvariantCulture),
            ["MaxHeartRateSource"] = string.Equals(thresholdsProfile.MaxHeartRateMode, MetricThresholdModes.Adaptive, StringComparison.OrdinalIgnoreCase) ? "Adaptive" : "Fixed",
            ["HeartRateZoneLowPercentMax"] = "<70",
            ["HeartRateZoneMediumPercentMax"] = "70-85",
            ["HeartRateZoneHighPercentMax"] = ">85",
            ["ThresholdVersion"] = thresholdsProfile.Version.ToString(CultureInfo.InvariantCulture),
            ["ThresholdUpdatedAtUtc"] = thresholdsProfile.UpdatedAtUtc.ToString("O", CultureInfo.InvariantCulture)
        };

        var metricAvailability = new Dictionary<string, TcxMetricAvailability>();

        void MarkMetric(string metricKey, string state, string? reason = null)
            => metricAvailability[metricKey] = new TcxMetricAvailability(state, reason);

        var gpsPoints = trackpoints
            .Where(tp => tp.TimeUtc.HasValue && tp.Latitude.HasValue && tp.Longitude.HasValue)
            .OrderBy(tp => tp.TimeUtc)
            .ToList();

        var segments = gpsPoints
            .Zip(gpsPoints.Skip(1), (previous, current) => new { previous, current })
            .Select(pair =>
            {
                var elapsedSeconds = (pair.current.TimeUtc!.Value - pair.previous.TimeUtc!.Value).TotalSeconds;
                if (elapsedSeconds <= 0)
                {
                    return (IsValid: false, Distance: 0.0, Speed: 0.0, Duration: 0.0);
                }

                var distanceMeters = HaversineMeters(
                    (pair.previous.Latitude!.Value, pair.previous.Longitude!.Value),
                    (pair.current.Latitude!.Value, pair.current.Longitude!.Value));
                var speedMps = distanceMeters / elapsedSeconds;

                return (IsValid: true, Distance: distanceMeters, Speed: speedMps, Duration: elapsedSeconds);
            })
            .Where(x => x.IsValid)
            .ToList();

        var hasGpsMeasurements = gpsPoints.Count > 0;
        var gpsSegmentsAreUsable = segments.Count > 0;
        var gpsQualityIsUsable = string.Equals(qualityStatus, "High", StringComparison.OrdinalIgnoreCase);

        double? sprintDistanceMeters = null;
        int? sprintCount = null;
        double? maxSpeed = null;
        double? highIntensityTimeSeconds = null;
        int? highIntensityRunCount = null;
        double? highSpeedDistanceMeters = null;
        double? runningDensityMetersPerMinute = null;
        int? accelerationCount = null;
        int? decelerationCount = null;
        double? distanceMeters = null;

        if (!hasGpsMeasurements)
        {
            foreach (var key in new[]
                     {
                         "distanceMeters", "sprintDistanceMeters", "sprintCount", "maxSpeedMetersPerSecond", "highIntensityTimeSeconds", "highIntensityRunCount",
                         "highSpeedDistanceMeters", "runningDensityMetersPerMinute", "accelerationCount", "decelerationCount"
                     })
            {
                MarkMetric(key, "NotMeasured", "GPS coordinates were not recorded for this session.");
            }
        }
        else if (!gpsSegmentsAreUsable)
        {
            foreach (var key in new[]
                     {
                         "distanceMeters", "sprintDistanceMeters", "sprintCount", "maxSpeedMetersPerSecond", "highIntensityTimeSeconds", "highIntensityRunCount",
                         "highSpeedDistanceMeters", "runningDensityMetersPerMinute", "accelerationCount", "decelerationCount"
                     })
            {
                MarkMetric(key, "NotUsable", "GPS measurements are present but do not contain usable time segments.");
            }
        }
        else if (!gpsQualityIsUsable)
        {
            foreach (var key in new[]
                     {
                         "distanceMeters", "sprintDistanceMeters", "sprintCount", "maxSpeedMetersPerSecond", "highIntensityTimeSeconds", "highIntensityRunCount",
                         "highSpeedDistanceMeters", "runningDensityMetersPerMinute", "accelerationCount", "decelerationCount"
                     })
            {
                MarkMetric(key, "NotUsable", $"GPS-derived metric is unusable because data quality is {qualityStatus}. Required: High.");
            }
        }
        else
        {
            var sprintThresholdMps = thresholdsProfile.EffectiveMaxSpeedMps * (thresholdsProfile.SprintSpeedPercentOfMaxSpeed / 100.0);
            var highIntensityThresholdMps = thresholdsProfile.EffectiveMaxSpeedMps * (thresholdsProfile.HighIntensitySpeedPercentOfMaxSpeed / 100.0);

            sprintDistanceMeters = segments.Where(segment => segment.Speed >= sprintThresholdMps).Sum(segment => segment.Distance);
            highSpeedDistanceMeters = segments.Where(segment => segment.Speed >= highIntensityThresholdMps).Sum(segment => segment.Distance);

            var sprintTransitions = 0;
            var currentlyInSprint = false;
            foreach (var segment in segments)
            {
                var isSprint = segment.Speed >= sprintThresholdMps;
                if (isSprint && !currentlyInSprint)
                {
                    sprintTransitions++;
                }

                currentlyInSprint = isSprint;
            }

            sprintCount = sprintTransitions;
            maxSpeed = segments.Max(segment => segment.Speed);
            highIntensityTimeSeconds = segments.Where(segment => segment.Speed >= highIntensityThresholdMps).Sum(segment => segment.Duration);

            var highIntensityTransitions = 0;
            var currentlyInHighIntensity = false;
            foreach (var segment in segments)
            {
                var isHighIntensity = segment.Speed >= highIntensityThresholdMps;
                if (isHighIntensity && !currentlyInHighIntensity)
                {
                    highIntensityTransitions++;
                }

                currentlyInHighIntensity = isHighIntensity;
            }

            highIntensityRunCount = highIntensityTransitions;

            var totalDurationSeconds = segments.Sum(segment => segment.Duration);
            runningDensityMetersPerMinute = totalDurationSeconds > 0
                ? (totalDistanceMeters ?? segments.Sum(segment => segment.Distance)) / (totalDurationSeconds / 60.0)
                : (double?)null;

            var localAccelerationCount = 0;
            var localDecelerationCount = 0;
            for (var index = 1; index < segments.Count; index++)
            {
                var elapsedSeconds = segments[index].Duration;
                if (elapsedSeconds <= 0)
                {
                    continue;
                }

                var acceleration = (segments[index].Speed - segments[index - 1].Speed) / elapsedSeconds;
                if (acceleration >= thresholdsProfile.AccelerationThresholdMps2)
                {
                    localAccelerationCount++;
                }
                else if (acceleration <= thresholdsProfile.DecelerationThresholdMps2)
                {
                    localDecelerationCount++;
                }
            }

            accelerationCount = localAccelerationCount;
            decelerationCount = localDecelerationCount;
            distanceMeters = totalDistanceMeters;

            foreach (var key in new[]
                     {
                         "distanceMeters", "sprintDistanceMeters", "sprintCount", "maxSpeedMetersPerSecond", "highIntensityTimeSeconds", "highIntensityRunCount",
                         "highSpeedDistanceMeters", "runningDensityMetersPerMinute", "accelerationCount", "decelerationCount"
                     })
            {
                MarkMetric(key, "Available");
            }
        }

        var pointsWithHrAndTime = trackpoints
            .Where(tp => tp.TimeUtc.HasValue && tp.HeartRateBpm.HasValue)
            .OrderBy(tp => tp.TimeUtc)
            .ToList();

        double? hrZoneLowSeconds = null;
        double? hrZoneMediumSeconds = null;
        double? hrZoneHighSeconds = null;
        double? trimpEdwards = null;
        int? hrRecoveryAfter60Seconds = null;

        if (pointsWithHrAndTime.Count >= 2)
        {
            var hrMax = thresholdsProfile.EffectiveMaxHeartRateBpm;
            if (hrMax > 0)
            {
                var lowSeconds = 0.0;
                var mediumSeconds = 0.0;
                var highSeconds = 0.0;

                foreach (var pair in pointsWithHrAndTime.Zip(pointsWithHrAndTime.Skip(1), (previous, current) => new { previous, current }))
                {
                    var elapsed = (pair.current.TimeUtc!.Value - pair.previous.TimeUtc!.Value).TotalSeconds;
                    if (elapsed <= 0)
                    {
                        continue;
                    }

                    var hr = ((pair.previous.HeartRateBpm!.Value + pair.current.HeartRateBpm!.Value) / 2.0) / hrMax;
                    if (hr < 0.70)
                    {
                        lowSeconds += elapsed;
                    }
                    else if (hr <= 0.85)
                    {
                        mediumSeconds += elapsed;
                    }
                    else
                    {
                        highSeconds += elapsed;
                    }
                }

                hrZoneLowSeconds = lowSeconds;
                hrZoneMediumSeconds = mediumSeconds;
                hrZoneHighSeconds = highSeconds;

                var zone50to60 = 0.0;
                var zone60to70 = 0.0;
                var zone70to80 = 0.0;
                var zone80to90 = 0.0;
                var zone90to100 = 0.0;

                foreach (var pair in pointsWithHrAndTime.Zip(pointsWithHrAndTime.Skip(1), (previous, current) => new { previous, current }))
                {
                    var elapsedMinutes = (pair.current.TimeUtc!.Value - pair.previous.TimeUtc!.Value).TotalMinutes;
                    if (elapsedMinutes <= 0)
                    {
                        continue;
                    }

                    var hrPercent = ((pair.previous.HeartRateBpm!.Value + pair.current.HeartRateBpm!.Value) / 2.0) / hrMax;
                    if (hrPercent < 0.50)
                    {
                        continue;
                    }

                    if (hrPercent < 0.60)
                    {
                        zone50to60 += elapsedMinutes;
                    }
                    else if (hrPercent < 0.70)
                    {
                        zone60to70 += elapsedMinutes;
                    }
                    else if (hrPercent < 0.80)
                    {
                        zone70to80 += elapsedMinutes;
                    }
                    else if (hrPercent < 0.90)
                    {
                        zone80to90 += elapsedMinutes;
                    }
                    else
                    {
                        zone90to100 += elapsedMinutes;
                    }
                }

                trimpEdwards = (zone50to60 * 1) + (zone60to70 * 2) + (zone70to80 * 3) + (zone80to90 * 4) + (zone90to100 * 5);

                var peakHrPoint = pointsWithHrAndTime.OrderByDescending(tp => tp.HeartRateBpm!.Value).ThenBy(tp => tp.TimeUtc).First();
                var targetTime = peakHrPoint.TimeUtc!.Value.AddSeconds(60);
                var recoveryPoint = pointsWithHrAndTime.FirstOrDefault(tp => tp.TimeUtc >= targetTime);
                if (recoveryPoint is not null)
                {
                    hrRecoveryAfter60Seconds = peakHrPoint.HeartRateBpm!.Value - recoveryPoint.HeartRateBpm!.Value;
                }

                foreach (var key in new[] { "heartRateZoneLowSeconds", "heartRateZoneMediumSeconds", "heartRateZoneHighSeconds", "trainingImpulseEdwards", "heartRateRecoveryAfter60Seconds" })
                {
                    MarkMetric(key, "Available");
                }
            }
            else
            {
                foreach (var key in new[] { "heartRateZoneLowSeconds", "heartRateZoneMediumSeconds", "heartRateZoneHighSeconds", "trainingImpulseEdwards", "heartRateRecoveryAfter60Seconds" })
                {
                    MarkMetric(key, "NotUsable", "Heart-rate values are present but not plausible for calculation.");
                }
            }
        }
        else
        {
            foreach (var key in new[] { "heartRateZoneLowSeconds", "heartRateZoneMediumSeconds", "heartRateZoneHighSeconds", "trainingImpulseEdwards", "heartRateRecoveryAfter60Seconds" })
            {
                MarkMetric(key, "NotMeasured", "Heart-rate values with timestamps are missing for this session.");
            }
        }

        var availableMetrics = metricAvailability.Count(entry => string.Equals(entry.Value.State, "Available", StringComparison.OrdinalIgnoreCase));

        return new TcxFootballCoreMetrics(
            availableMetrics > 0,
            availableMetrics > 0 ? null : "No core metric could be calculated from the available measurements.",
            distanceMeters,
            sprintDistanceMeters,
            sprintCount,
            maxSpeed,
            highIntensityTimeSeconds,
            highIntensityRunCount,
            highSpeedDistanceMeters,
            runningDensityMetersPerMinute,
            accelerationCount,
            decelerationCount,
            hrZoneLowSeconds,
            hrZoneMediumSeconds,
            hrZoneHighSeconds,
            trimpEdwards,
            hrRecoveryAfter60Seconds,
            metricAvailability,
            thresholds);
    }

    private static int CountUnplausibleGpsJumps(IReadOnlyList<TrackpointSnapshot> trackpoints, double outlierSpeedThresholdMps)
    {
        var pointsWithGpsAndTime = trackpoints
            .Where(tp => tp.TimeUtc.HasValue && tp.Latitude.HasValue && tp.Longitude.HasValue)
            .OrderBy(tp => tp.TimeUtc)
            .ToList();

        if (pointsWithGpsAndTime.Count < 2)
        {
            return 0;
        }

        var unplausibleJumpCount = 0;
        for (var index = 1; index < pointsWithGpsAndTime.Count; index++)
        {
            var previous = pointsWithGpsAndTime[index - 1];
            var current = pointsWithGpsAndTime[index];
            var elapsedSeconds = (current.TimeUtc!.Value - previous.TimeUtc!.Value).TotalSeconds;
            if (elapsedSeconds <= 0)
            {
                continue;
            }

            var distanceMeters = HaversineMeters(
                (previous.Latitude!.Value, previous.Longitude!.Value),
                (current.Latitude!.Value, current.Longitude!.Value));

            var speedMetersPerSecond = distanceMeters / elapsedSeconds;
            if (speedMetersPerSecond > outlierSpeedThresholdMps)
            {
                unplausibleJumpCount++;
            }
        }

        return unplausibleJumpCount;
    }


}
