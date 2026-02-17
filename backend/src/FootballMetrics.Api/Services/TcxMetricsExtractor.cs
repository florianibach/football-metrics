using System.Globalization;
using System.Xml.Linq;
using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public static class TcxMetricsExtractor
{
    private const double EarthRadiusMeters = 6_371_000;
    private const double MaxPlausibleSpeedMetersPerSecond = 12.5;

    public static TcxActivitySummary Extract(XDocument document)
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

        var smoothedTrackpoints = ApplyFootballAdaptiveSmoothing(trackpointSnapshots, outlierSpeedThresholdMps, out var correctedOutlierCount);
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
        var smoothingTrace = BuildSmoothingTrace(trackpointSnapshots, smoothedTrackpoints, rawDistanceMeters, smoothedDistanceMeters, correctedOutlierCount, outlierSpeedThresholdMps);

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
            smoothingTrace);
    }

    private static TcxSmoothingTrace BuildSmoothingTrace(
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

        return new TcxSmoothingTrace(
            "FootballAdaptiveMedian",
            new Dictionary<string, string>
            {
                ["AdaptiveTurnThresholdDegrees"] = "25",
                ["BaseWindowSize"] = "5",
                ["SharpTurnWindowSize"] = "3",
                ["OutlierDetectionMode"] = "AdaptiveMadWithAbsoluteCap",
                ["AbsoluteSpeedCapMps"] = "12.5",
                ["EffectiveOutlierSpeedThresholdMps"] = outlierSpeedThresholdMps.ToString("0.###", CultureInfo.InvariantCulture)
            },
            rawDistanceMeters,
            smoothedDistanceMeters,
            rawDirectionChanges,
            baselineDirectionChanges,
            smoothedDirectionChanges,
            correctedOutlierCount,
            DateTime.UtcNow);
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

    private static DateTime? ResolveStartTimeUtc(XDocument document, IReadOnlyCollection<XElement> trackpoints)
    {
        var activityId = document
            .Descendants()
            .FirstOrDefault(node => string.Equals(node.Name.LocalName, "Id", StringComparison.OrdinalIgnoreCase))?.Value;

        var parsedActivityId = ParseDateTime(activityId);
        if (parsedActivityId.HasValue)
        {
            return parsedActivityId;
        }

        return trackpoints
            .Select(tp => ParseDateTime(tp.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "Time", StringComparison.OrdinalIgnoreCase))?.Value))
            .FirstOrDefault(value => value.HasValue);
    }

    private static double? ResolveDurationSeconds(IReadOnlyCollection<XElement> trackpoints)
    {
        var first = trackpoints
            .Select(tp => ParseDateTime(tp.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "Time", StringComparison.OrdinalIgnoreCase))?.Value))
            .FirstOrDefault(value => value.HasValue);

        var last = trackpoints
            .Select(tp => ParseDateTime(tp.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "Time", StringComparison.OrdinalIgnoreCase))?.Value))
            .LastOrDefault(value => value.HasValue);

        if (!first.HasValue || !last.HasValue || last < first)
        {
            return null;
        }

        return (last.Value - first.Value).TotalSeconds;
    }

    private static double CalculateDistanceMeters(IReadOnlyList<(double Lat, double Lon)> points)
    {
        double total = 0;
        for (var index = 1; index < points.Count; index++)
        {
            total += HaversineMeters(points[index - 1], points[index]);
        }

        return total;
    }

    private static double HaversineMeters((double Lat, double Lon) start, (double Lat, double Lon) end)
    {
        var lat1 = DegreesToRadians(start.Lat);
        var lat2 = DegreesToRadians(end.Lat);
        var deltaLat = DegreesToRadians(end.Lat - start.Lat);
        var deltaLon = DegreesToRadians(end.Lon - start.Lon);

        var a = Math.Pow(Math.Sin(deltaLat / 2), 2)
                + Math.Cos(lat1) * Math.Cos(lat2) * Math.Pow(Math.Sin(deltaLon / 2), 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return EarthRadiusMeters * c;
    }

    private static double DegreesToRadians(double value) => value * Math.PI / 180;

    private static int? ParseInt(string? value)
        => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;

    private static double? ParseDouble(string? value)
        => double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;

    private static DateTime? ParseDateTime(string? value)
        => DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed)
            ? parsed
            : null;

    private sealed record TrackpointSnapshot(DateTime? TimeUtc, int? HeartRateBpm, double? Latitude, double? Longitude);
    private sealed record QualityAssessment(string Status, IReadOnlyList<string> Reasons);
}
