using System.Globalization;
using System.Xml.Linq;
using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public static partial class TcxMetricsExtractor
{
    private const double EarthRadiusMeters = 6_371_000;
    private const double MaxPlausibleSpeedMetersPerSecond = 12.5;
    private const double DirectionChangeThresholdDegrees = 45.0;
    private const double BaselineDirectionChangeThresholdDegrees = 65.0;
    private const double DirectionChangeMinimumSpeedMetersPerSecond = 10.0 / 3.6;
    private const int DirectionChangeConsecutiveSamplesRequired = 2;
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
        var dataAvailability = BuildDataAvailability(rawGpsPoints.Count > 0, heartRates.Count > 0, qualityAssessment.Status, qualityAssessment.GpsAssessment, qualityAssessment.HeartRateAssessment);
        var smoothingTrace = BuildSmoothingTrace(normalizedFilter, trackpointSnapshots, smoothedTrackpoints, rawDistanceMeters, smoothedDistanceMeters, correctedOutlierCount, outlierSpeedThresholdMps);
        var effectiveThresholds = thresholdProfile ?? MetricThresholdProfile.CreateDefault();
        var (coreMetrics, detectedRuns) = BuildFootballCoreMetrics(smoothedTrackpoints, qualityAssessment.Status, finalDistance, effectiveThresholds);
        var intervalAggregates = BuildIntervalAggregates(smoothedTrackpoints, effectiveThresholds);


        var heartRateSamples = smoothedTrackpoints
            .Where(snapshot => snapshot.TimeUtc.HasValue && snapshot.HeartRateBpm.HasValue && startTime.HasValue)
            .Select(snapshot => new TcxHeartRateSample(
                Math.Max(0, (snapshot.TimeUtc!.Value - startTime!.Value).TotalSeconds),
                snapshot.HeartRateBpm!.Value))
            .ToList();

        var gpsTrackpoints = smoothedTrackpoints
            .Where(snapshot => snapshot.Latitude.HasValue && snapshot.Longitude.HasValue)
            .Select(snapshot => new TcxGpsTrackpoint(
                snapshot.Latitude!.Value,
                snapshot.Longitude!.Value,
                snapshot.TimeUtc.HasValue && startTime.HasValue
                    ? Math.Max(0, (snapshot.TimeUtc.Value - startTime.Value).TotalSeconds)
                    : null,
                snapshot.HeartRateBpm))
            .ToList();

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
            gpsTrackpoints,
            heartRateSamples,
            smoothingTrace,
            coreMetrics,
            intervalAggregates,
            detectedRuns);
    }


    private static TcxDataAvailability BuildDataAvailability(bool hasGpsData, bool hasHeartRateData, string qualityStatus, ChannelQualityAssessment gpsAssessment, ChannelQualityAssessment heartRateAssessment)
    {
        var gpsStatus = hasGpsData
            ? (string.Equals(gpsAssessment.Status, "Low", StringComparison.OrdinalIgnoreCase)
                ? "NotUsable"
                : string.Equals(gpsAssessment.Status, "Medium", StringComparison.OrdinalIgnoreCase)
                    ? "AvailableWithWarning"
                    : "Available")
            : "NotMeasured";
        var gpsReason = gpsStatus switch
        {
            "NotMeasured" => "GPS not present in this session.",
            "NotUsable" => $"GPS unusable because GPS-channel quality is {gpsAssessment.Status}.",
            "AvailableWithWarning" => $"GPS available with warning because GPS-channel quality is {gpsAssessment.Status}.",
            _ => null
        };

        var heartRateStatus = hasHeartRateData
            ? (string.Equals(heartRateAssessment.Status, "Low", StringComparison.OrdinalIgnoreCase)
                ? "NotUsable"
                : string.Equals(heartRateAssessment.Status, "Medium", StringComparison.OrdinalIgnoreCase)
                    ? "AvailableWithWarning"
                    : "Available")
            : "NotMeasured";
        var heartRateReason = heartRateStatus switch
        {
            "NotMeasured" => "Heart-rate data not present in this session.",
            "NotUsable" => $"Heart-rate data unusable because HR-channel quality is {heartRateAssessment.Status}.",
            "AvailableWithWarning" => $"Heart-rate data available with warning because HR-channel quality is {heartRateAssessment.Status}.",
            _ => null
        };

        var mode = (hasGpsData, hasHeartRateData) switch
        {
            (true, true) => "Dual",
            (true, false) => "GpsOnly",
            (false, true) => "HeartRateOnly",
            _ => "NotAvailable"
        };

        return new TcxDataAvailability(mode, gpsStatus, gpsReason, heartRateStatus, heartRateReason, gpsAssessment.Status, gpsAssessment.Reasons, heartRateAssessment.Status, heartRateAssessment.Reasons);
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
        var rawDirectionChanges = CountDirectionChanges(rawTrackpoints, DirectionChangeThresholdDegrees, DirectionChangeMinimumSpeedMetersPerSecond, DirectionChangeConsecutiveSamplesRequired);
        var baselineDirectionChanges = CountDirectionChanges(rawTrackpoints, BaselineDirectionChangeThresholdDegrees, DirectionChangeMinimumSpeedMetersPerSecond, DirectionChangeConsecutiveSamplesRequired);
        var smoothedDirectionChanges = CountDirectionChanges(smoothedTrackpoints, DirectionChangeThresholdDegrees, DirectionChangeMinimumSpeedMetersPerSecond, DirectionChangeConsecutiveSamplesRequired);

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
                ["DirectionChangeThresholdDegrees"] = DirectionChangeThresholdDegrees.ToString("0", CultureInfo.InvariantCulture),
                ["DirectionChangeMinSpeedMps"] = DirectionChangeMinimumSpeedMetersPerSecond.ToString("0.###", CultureInfo.InvariantCulture),
                ["DirectionChangeConsecutiveSamplesRequired"] = DirectionChangeConsecutiveSamplesRequired.ToString(CultureInfo.InvariantCulture),
                ["BaseWindowSize"] = "5",
                ["SharpTurnWindowSize"] = "3",
                ["OutlierDetectionMode"] = "AdaptiveMadWithAbsoluteCap",
                ["AbsoluteSpeedCapMps"] = "12.5",
                ["EffectiveOutlierSpeedThresholdMps"] = outlierSpeedThresholdMps.ToString("0.###", CultureInfo.InvariantCulture)
            }
        };

        var correctedPointRatio = rawTrackpoints.Count == 0
            ? 0
            : correctedOutlierCount / (double)rawTrackpoints.Count;

        return new TcxSmoothingTrace(
            selectedStrategy,
            parameters,
            rawDistanceMeters,
            smoothedDistanceMeters,
            rawDirectionChanges,
            baselineDirectionChanges,
            smoothedDirectionChanges,
            correctedOutlierCount,
            correctedOutlierCount,
            correctedPointRatio,
            "AdaptiveInterpolation",
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

    private static (int TotalCount, int ModerateCount, int HighCount, int VeryHighCount) DetectDirectionChangeBands(
        IReadOnlyList<TrackpointSnapshot> points,
        double moderateThresholdDegrees,
        double highThresholdDegrees,
        double veryHighThresholdDegrees,
        double minimumSpeedMetersPerSecond,
        int consecutiveSamplesRequired)
    {
        var pointsWithGps = points
            .Where(point => HasGps(point) && HasTimestamp(point))
            .OrderBy(point => point.TimeUtc)
            .ToList();

        if (pointsWithGps.Count < 3)
        {
            return (0, 0, 0, 0);
        }

        var events = 0;
        var moderate = 0;
        var high = 0;
        var veryHigh = 0;
        var consecutiveCandidates = 0;
        var inEvent = false;
        int? candidateTurnDirection = null;
        CodBand? currentBand = null;

        for (var index = 1; index < pointsWithGps.Count - 1; index++)
        {
            var previous = pointsWithGps[index - 1];
            var current = pointsWithGps[index];
            var next = pointsWithGps[index + 1];

            var incoming = CalculateBearingDegrees(previous, current);
            var outgoing = CalculateBearingDegrees(current, next);
            var signedTurn = CalculateSignedTurnDeltaDegrees(incoming, outgoing);
            var turn = Math.Abs(signedTurn);
            var incomingSpeed = CalculateSegmentSpeedMetersPerSecond(previous, current);
            var outgoingSpeed = CalculateSegmentSpeedMetersPerSecond(current, next);

            var isSpeedValid = incomingSpeed.HasValue
                && outgoingSpeed.HasValue
                && incomingSpeed.Value >= minimumSpeedMetersPerSecond
                && outgoingSpeed.Value >= minimumSpeedMetersPerSecond;

            if (!isSpeedValid)
            {
                consecutiveCandidates = 0;
                candidateTurnDirection = null;
                currentBand = null;
                inEvent = false;
                continue;
            }

            var band = ResolveCodBand(turn, moderateThresholdDegrees, highThresholdDegrees, veryHighThresholdDegrees);
            if (!band.HasValue)
            {
                consecutiveCandidates = 0;
                candidateTurnDirection = null;
                currentBand = null;
                inEvent = false;
                continue;
            }

            var turnDirection = Math.Sign(signedTurn);
            if (consecutiveCandidates == 0 || (candidateTurnDirection == turnDirection && currentBand == band.Value))
            {
                candidateTurnDirection = turnDirection;
                currentBand = band.Value;
                consecutiveCandidates++;
            }
            else
            {
                candidateTurnDirection = turnDirection;
                currentBand = band.Value;
                consecutiveCandidates = 1;
                inEvent = false;
            }

            if (!inEvent && consecutiveCandidates >= consecutiveSamplesRequired)
            {
                events++;
                inEvent = true;
                switch (band.Value)
                {
                    case CodBand.Moderate:
                        moderate++;
                        break;
                    case CodBand.High:
                        high++;
                        break;
                    case CodBand.VeryHigh:
                        veryHigh++;
                        break;
                }
            }
        }

        return (events, moderate, high, veryHigh);
    }

    private static CodBand? ResolveCodBand(
        double deltaAngleDegrees,
        double moderateThresholdDegrees,
        double highThresholdDegrees,
        double veryHighThresholdDegrees)
    {
        if (deltaAngleDegrees >= veryHighThresholdDegrees)
        {
            return CodBand.VeryHigh;
        }

        if (deltaAngleDegrees >= highThresholdDegrees)
        {
            return CodBand.High;
        }

        if (deltaAngleDegrees >= moderateThresholdDegrees)
        {
            return CodBand.Moderate;
        }

        return null;
    }

    private static int CountDirectionChanges(
        IReadOnlyList<TrackpointSnapshot> points,
        double thresholdDegrees,
        double minimumSpeedMetersPerSecond,
        int consecutiveSamplesRequired)
    {
        var pointsWithGps = points
            .Where(point => HasGps(point) && HasTimestamp(point))
            .OrderBy(point => point.TimeUtc)
            .ToList();

        if (pointsWithGps.Count < 3)
        {
            return 0;
        }

        var events = 0;
        var consecutiveCandidates = 0;
        var inEvent = false;
        int? candidateTurnDirection = null;

        for (var index = 1; index < pointsWithGps.Count - 1; index++)
        {
            var previous = pointsWithGps[index - 1];
            var current = pointsWithGps[index];
            var next = pointsWithGps[index + 1];
            var incoming = CalculateBearingDegrees(previous, current);
            var outgoing = CalculateBearingDegrees(current, next);
            var signedTurn = CalculateSignedTurnDeltaDegrees(incoming, outgoing);
            var turn = Math.Abs(signedTurn);
            var incomingSpeed = CalculateSegmentSpeedMetersPerSecond(previous, current);
            var outgoingSpeed = CalculateSegmentSpeedMetersPerSecond(current, next);

            var isCandidate = turn >= thresholdDegrees
                              && incomingSpeed.HasValue
                              && outgoingSpeed.HasValue
                              && incomingSpeed.Value >= minimumSpeedMetersPerSecond
                              && outgoingSpeed.Value >= minimumSpeedMetersPerSecond;

            if (isCandidate)
            {
                var turnDirection = Math.Sign(signedTurn);
                if (consecutiveCandidates == 0 || candidateTurnDirection == turnDirection)
                {
                    candidateTurnDirection = turnDirection;
                    consecutiveCandidates++;
                }
                else
                {
                    candidateTurnDirection = turnDirection;
                    consecutiveCandidates = 1;
                    inEvent = false;
                }

                if (!inEvent && consecutiveCandidates >= consecutiveSamplesRequired)
                {
                    events++;
                    inEvent = true;
                }
            }
            else
            {
                consecutiveCandidates = 0;
                candidateTurnDirection = null;
                inEvent = false;
            }
        }

        return events;
    }

    private static double? CalculateSegmentSpeedMetersPerSecond(TrackpointSnapshot from, TrackpointSnapshot to)
    {
        if (!from.TimeUtc.HasValue || !to.TimeUtc.HasValue || !HasGps(from) || !HasGps(to))
        {
            return null;
        }

        var elapsedSeconds = (to.TimeUtc.Value - from.TimeUtc.Value).TotalSeconds;
        if (elapsedSeconds <= 0)
        {
            return null;
        }

        var distanceMeters = HaversineMeters((from.Latitude!.Value, from.Longitude!.Value), (to.Latitude!.Value, to.Longitude!.Value));
        return distanceMeters / elapsedSeconds;
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

    private static double CalculateSignedTurnDeltaDegrees(double firstBearing, double secondBearing)
    {
        var delta = (secondBearing - firstBearing + 540) % 360 - 180;
        return delta;
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

            var (intervalCoreMetrics, _) = BuildFootballCoreMetrics(
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
            var empty = new ChannelQualityAssessment("Low", new List<string> { "No trackpoints found in TCX file." });
            return new QualityAssessment("Low", new List<string> { "No trackpoints found in TCX file." }, empty, empty);
        }

        var reasons = new List<string>();
        var penaltyPoints = 0;

        var missingTimestampCount = trackpoints.Count(tp => !tp.TimeUtc.HasValue);
        var missingGpsCount = trackpoints.Count(tp => !tp.Latitude.HasValue || !tp.Longitude.HasValue);
        var missingHeartRateCount = trackpoints.Count(tp => !tp.HeartRateBpm.HasValue);

        var missingTimestampRatio = (double)missingTimestampCount / trackpoints.Count;
        var missingGpsRatio = (double)missingGpsCount / trackpoints.Count;
        var missingHeartRateRatio = (double)missingHeartRateCount / trackpoints.Count;

        var gpsReasons = new List<string>();
        var hrReasons = new List<string>();

        if (missingTimestampRatio > 0.5)
        {
            penaltyPoints += 2;
            reasons.Add($"Many trackpoints are missing timestamps ({missingTimestampCount}/{trackpoints.Count}).");
            gpsReasons.Add($"Many trackpoints are missing timestamps ({missingTimestampCount}/{trackpoints.Count}).");
            hrReasons.Add($"Many trackpoints are missing timestamps ({missingTimestampCount}/{trackpoints.Count}).");
        }
        else if (missingTimestampRatio > 0.1)
        {
            penaltyPoints += 1;
            reasons.Add($"Some trackpoints are missing timestamps ({missingTimestampCount}/{trackpoints.Count}).");
            gpsReasons.Add($"Some trackpoints are missing timestamps ({missingTimestampCount}/{trackpoints.Count}).");
            hrReasons.Add($"Some trackpoints are missing timestamps ({missingTimestampCount}/{trackpoints.Count}).");
        }

        var gpsPenaltyPoints = 0;
        if (missingGpsRatio > 0.5)
        {
            penaltyPoints += 2;
            gpsPenaltyPoints += 2;
            var reason = $"GPS coverage is limited ({trackpoints.Count - missingGpsCount}/{trackpoints.Count} points with coordinates).";
            reasons.Add(reason);
            gpsReasons.Add(reason);
        }
        else if (missingGpsRatio > 0.1)
        {
            penaltyPoints += 1;
            gpsPenaltyPoints += 1;
            var reason = $"GPS data is partially missing ({trackpoints.Count - missingGpsCount}/{trackpoints.Count} points with coordinates).";
            reasons.Add(reason);
            gpsReasons.Add(reason);
        }

        var hrPenaltyPoints = 0;
        if (missingHeartRateRatio > 0.5)
        {
            penaltyPoints += 2;
            hrPenaltyPoints += 2;
            var reason = $"Heart rate data is mostly missing ({trackpoints.Count - missingHeartRateCount}/{trackpoints.Count} points with heart rate).";
            reasons.Add(reason);
            hrReasons.Add(reason);
        }
        else if (missingHeartRateRatio > 0.1)
        {
            penaltyPoints += 1;
            hrPenaltyPoints += 1;
            var reason = $"Heart rate data is partially missing ({trackpoints.Count - missingHeartRateCount}/{trackpoints.Count} points with heart rate).";
            reasons.Add(reason);
            hrReasons.Add(reason);
        }

        var (unplausibleJumpCount, clusteredJumpCount) = CountUnplausibleGpsJumps(trackpoints, outlierSpeedThresholdMps);
        var gpsPointsWithTime = trackpoints.Count(tp => tp.TimeUtc.HasValue && tp.Latitude.HasValue && tp.Longitude.HasValue);
        var jumpRatio = gpsPointsWithTime == 0 ? 0d : (double)unplausibleJumpCount / gpsPointsWithTime;
        if (unplausibleJumpCount >= 2)
        {
            var clusteredOrSignificant = clusteredJumpCount > 0 || jumpRatio >= 0.01;
            var jumpPenalty = clusteredOrSignificant ? 2 : 1;
            penaltyPoints += jumpPenalty;
            gpsPenaltyPoints += jumpPenalty;
            var reason = clusteredOrSignificant
                ? $"Detected multiple implausible GPS jumps ({unplausibleJumpCount})."
                : $"Detected isolated implausible GPS jumps ({unplausibleJumpCount}) with low share ({jumpRatio:P2}).";
            reasons.Add(reason);
            gpsReasons.Add(reason);
        }
        else if (unplausibleJumpCount > 0)
        {
            penaltyPoints += 1;
            gpsPenaltyPoints += 1;
            var reason = $"Detected isolated implausible GPS jumps ({unplausibleJumpCount}).";
            reasons.Add(reason);
            gpsReasons.Add(reason);
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

        if (gpsReasons.Count == 0)
        {
            gpsReasons.Add("GPS measurements are complete and consistent.");
        }

        if (hrReasons.Count == 0)
        {
            hrReasons.Add("Heart-rate measurements are complete and consistent.");
        }

        var gpsStatus = gpsPenaltyPoints >= 4 ? "Low" : gpsPenaltyPoints >= 2 ? "Medium" : "High";
        var hrStatus = hrPenaltyPoints >= 4 ? "Low" : hrPenaltyPoints >= 2 ? "Medium" : "High";

        return new QualityAssessment(status, reasons, new ChannelQualityAssessment(gpsStatus, gpsReasons), new ChannelQualityAssessment(hrStatus, hrReasons));
    }

private static (TcxFootballCoreMetrics CoreMetrics, IReadOnlyList<TcxDetectedRun> DetectedRuns) BuildFootballCoreMetrics(
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
            ["ModerateAccelerationThresholdMps2"] = thresholdsProfile.ModerateAccelerationThresholdMps2.ToString("0.0", CultureInfo.InvariantCulture),
            ["HighAccelerationThresholdMps2"] = thresholdsProfile.HighAccelerationThresholdMps2.ToString("0.0", CultureInfo.InvariantCulture),
            ["VeryHighAccelerationThresholdMps2"] = thresholdsProfile.VeryHighAccelerationThresholdMps2.ToString("0.0", CultureInfo.InvariantCulture),
            ["ModerateDecelerationThresholdMps2"] = thresholdsProfile.ModerateDecelerationThresholdMps2.ToString("0.0", CultureInfo.InvariantCulture),
            ["HighDecelerationThresholdMps2"] = thresholdsProfile.HighDecelerationThresholdMps2.ToString("0.0", CultureInfo.InvariantCulture),
            ["VeryHighDecelerationThresholdMps2"] = thresholdsProfile.VeryHighDecelerationThresholdMps2.ToString("0.0", CultureInfo.InvariantCulture),
            ["AccelDecelMinimumSpeedMps"] = thresholdsProfile.AccelDecelMinimumSpeedMps.ToString("0.00", CultureInfo.InvariantCulture),
            ["CodModerateThresholdDegrees"] = thresholdsProfile.CodModerateThresholdDegrees.ToString("0.0", CultureInfo.InvariantCulture),
            ["CodHighThresholdDegrees"] = thresholdsProfile.CodHighThresholdDegrees.ToString("0.0", CultureInfo.InvariantCulture),
            ["CodVeryHighThresholdDegrees"] = thresholdsProfile.CodVeryHighThresholdDegrees.ToString("0.0", CultureInfo.InvariantCulture),
            ["CodMinimumSpeedMps"] = thresholdsProfile.CodMinimumSpeedMps.ToString("0.00", CultureInfo.InvariantCulture),
            ["CodConsecutiveSamplesRequired"] = thresholdsProfile.CodConsecutiveSamplesRequired.ToString(CultureInfo.InvariantCulture),
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

        var gpsStartTime = gpsPoints.FirstOrDefault()?.TimeUtc;

        var segments = gpsPoints
            .Zip(gpsPoints.Skip(1), (previous, current) => new { previous, current })
            .Select((pair, index) =>
            {
                var elapsedSeconds = (pair.current.TimeUtc!.Value - pair.previous.TimeUtc!.Value).TotalSeconds;
                if (elapsedSeconds <= 0 || !gpsStartTime.HasValue)
                {
                    return (IsValid: false, PointIndex: index, StartElapsedSeconds: 0.0, EndElapsedSeconds: 0.0, Distance: 0.0, Speed: 0.0, Duration: 0.0);
                }

                var distanceMeters = HaversineMeters(
                    (pair.previous.Latitude!.Value, pair.previous.Longitude!.Value),
                    (pair.current.Latitude!.Value, pair.current.Longitude!.Value));
                var speedMps = distanceMeters / elapsedSeconds;

                return (
                    IsValid: true,
                    PointIndex: index,
                    StartElapsedSeconds: Math.Max(0, (pair.previous.TimeUtc.Value - gpsStartTime.Value).TotalSeconds),
                    EndElapsedSeconds: Math.Max(0, (pair.current.TimeUtc.Value - gpsStartTime.Value).TotalSeconds),
                    Distance: distanceMeters,
                    Speed: speedMps,
                    Duration: elapsedSeconds);
            })
            .Where(x => x.IsValid)
            .ToList();

        var hasGpsMeasurements = gpsPoints.Count > 0;
        var gpsSegmentsAreUsable = segments.Count > 0;
        var gpsQualityIsUsable = !string.Equals(qualityStatus, "Low", StringComparison.OrdinalIgnoreCase);

        double? sprintDistanceMeters = null;
        int? sprintCount = null;
        double? maxSpeed = null;
        double? highIntensityTimeSeconds = null;
        int? highIntensityRunCount = null;
        double? highSpeedDistanceMeters = null;
        double? runningDensityMetersPerMinute = null;
        int? accelerationCount = null;
        int? decelerationCount = null;
        int? moderateAccelerationCount = null;
        int? highAccelerationCount = null;
        int? veryHighAccelerationCount = null;
        int? moderateDecelerationCount = null;
        int? highDecelerationCount = null;
        int? veryHighDecelerationCount = null;
        int? directionChanges = null;
        int? moderateDirectionChangeCount = null;
        int? highDirectionChangeCount = null;
        int? veryHighDirectionChangeCount = null;
        double? distanceMeters = null;
        var detectedRuns = new List<TcxDetectedRun>();

        if (!hasGpsMeasurements)
        {
            foreach (var key in new[]
                     {
                         "distanceMeters", "sprintDistanceMeters", "sprintCount", "maxSpeedMetersPerSecond", "highIntensityTimeSeconds", "highIntensityRunCount",
                         "highSpeedDistanceMeters", "runningDensityMetersPerMinute", "accelerationCount", "decelerationCount", "directionChanges",
                         "moderateAccelerationCount", "highAccelerationCount", "veryHighAccelerationCount", "moderateDecelerationCount", "highDecelerationCount", "veryHighDecelerationCount",
                         "moderateDirectionChangeCount", "highDirectionChangeCount", "veryHighDirectionChangeCount"
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
                         "highSpeedDistanceMeters", "runningDensityMetersPerMinute", "accelerationCount", "decelerationCount", "directionChanges",
                         "moderateAccelerationCount", "highAccelerationCount", "veryHighAccelerationCount", "moderateDecelerationCount", "highDecelerationCount", "veryHighDecelerationCount",
                         "moderateDirectionChangeCount", "highDirectionChangeCount", "veryHighDirectionChangeCount"
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
                         "highSpeedDistanceMeters", "runningDensityMetersPerMinute", "accelerationCount", "decelerationCount", "directionChanges",
                         "moderateAccelerationCount", "highAccelerationCount", "veryHighAccelerationCount", "moderateDecelerationCount", "highDecelerationCount", "veryHighDecelerationCount",
                         "moderateDirectionChangeCount", "highDirectionChangeCount", "veryHighDirectionChangeCount"
                     })
            {
                MarkMetric(key, "NotUsable", $"GPS-derived metric is unusable because data quality is {qualityStatus}.");
            }
        }
        else
        {
            var sprintThresholdMps = thresholdsProfile.EffectiveMaxSpeedMps * (thresholdsProfile.SprintSpeedPercentOfMaxSpeed / 100.0);
            var highIntensityThresholdMps = thresholdsProfile.EffectiveMaxSpeedMps * (thresholdsProfile.HighIntensitySpeedPercentOfMaxSpeed / 100.0);

            var segmentsForDetection = segments
                .Select(segment => (segment.PointIndex, segment.StartElapsedSeconds, segment.EndElapsedSeconds, segment.Distance, segment.Speed, segment.Duration))
                .ToList();

            var sprintRuns = DetectRunsWithConsecutiveSamples(segmentsForDetection, sprintThresholdMps, "sprint");
            var highIntensityRuns = DetectRunsWithConsecutiveSamples(segmentsForDetection, highIntensityThresholdMps, "highIntensity");

            sprintDistanceMeters = sprintRuns.Sum(run => run.DistanceMeters);

            var highIntensityPointIndexLookup = highIntensityRuns
                .ToDictionary(run => run.RunId, run => run.PointIndices.ToHashSet());

            var sprintParentAssignments = sprintRuns
                .Select(sprintRun =>
                {
                    var containingParent = highIntensityRuns
                        .Where(highIntensityRun =>
                            sprintRun.PointIndices.All(pointIndex => highIntensityPointIndexLookup[highIntensityRun.RunId].Contains(pointIndex)))
                        .OrderBy(highIntensityRun => highIntensityRun.StartElapsedSeconds)
                        .FirstOrDefault();

                    if (containingParent is not null)
                    {
                        return new { SprintRun = sprintRun, ParentRunId = containingParent.RunId };
                    }

                    var overlappingParent = highIntensityRuns
                        .Select(highIntensityRun => new
                        {
                            RunId = highIntensityRun.RunId,
                            OverlapCount = sprintRun.PointIndices.Count(pointIndex => highIntensityPointIndexLookup[highIntensityRun.RunId].Contains(pointIndex)),
                            highIntensityRun.StartElapsedSeconds
                        })
                        .Where(candidate => candidate.OverlapCount > 0)
                        .OrderByDescending(candidate => candidate.OverlapCount)
                        .ThenBy(candidate => candidate.StartElapsedSeconds)
                        .FirstOrDefault();

                    return new { SprintRun = sprintRun, ParentRunId = overlappingParent?.RunId };
                })
                .ToList();

            var hierarchicalHighIntensityRuns = highIntensityRuns
                .Select(highIntensityRun =>
                {
                    var sprintPhasesForRun = sprintParentAssignments
                        .Where(assignment => assignment.ParentRunId == highIntensityRun.RunId)
                        .Select(assignment => new TcxSprintPhase(
                            assignment.SprintRun.RunId,
                            assignment.SprintRun.StartElapsedSeconds,
                            assignment.SprintRun.DurationSeconds,
                            assignment.SprintRun.DistanceMeters,
                            assignment.SprintRun.TopSpeedMetersPerSecond,
                            assignment.SprintRun.PointIndices,
                            highIntensityRun.RunId))
                        .OrderBy(phase => phase.StartElapsedSeconds)
                        .ToList();

                    return highIntensityRun with { SprintPhases = sprintPhasesForRun };
                })
                .OrderBy(run => run.StartElapsedSeconds)
                .ThenBy(run => run.RunType)
                .ToList();

            detectedRuns = hierarchicalHighIntensityRuns;

            sprintCount = sprintRuns.Count;
            maxSpeed = segments.Max(segment => segment.Speed);
            highSpeedDistanceMeters = highIntensityRuns.Sum(run => run.DistanceMeters);
            highIntensityTimeSeconds = highIntensityRuns.Sum(run => run.DurationSeconds);
            highIntensityRunCount = highIntensityRuns.Count;

            var totalDurationSeconds = segments.Sum(segment => segment.Duration);
            runningDensityMetersPerMinute = totalDurationSeconds > 0
                ? (totalDistanceMeters ?? segments.Sum(segment => segment.Distance)) / (totalDurationSeconds / 60.0)
                : (double?)null;

            var accelerationSamples = segments
                .Select(segment => new SpeedSample(segment.EndElapsedSeconds, segment.Speed, segment.Distance))
                .ToList();

            var accelerationWindowSamples = BuildAccelerationWindowSamples(accelerationSamples, thresholdsProfile);

            var moderateAccelerationEvents = DetectBandEvents(accelerationWindowSamples, AccelDecelBand.Moderate, sample => sample.AccelerationBand);
            var highAccelerationEvents = DetectBandEvents(accelerationWindowSamples, AccelDecelBand.High, sample => sample.AccelerationBand);
            var veryHighAccelerationEvents = DetectBandEvents(accelerationWindowSamples, AccelDecelBand.VeryHigh, sample => sample.AccelerationBand);
            var moderateDecelerationEvents = DetectBandEvents(accelerationWindowSamples, AccelDecelBand.Moderate, sample => sample.DecelerationBand);
            var highDecelerationEvents = DetectBandEvents(accelerationWindowSamples, AccelDecelBand.High, sample => sample.DecelerationBand);
            var veryHighDecelerationEvents = DetectBandEvents(accelerationWindowSamples, AccelDecelBand.VeryHigh, sample => sample.DecelerationBand);

            moderateAccelerationCount = moderateAccelerationEvents.EventCount;
            highAccelerationCount = highAccelerationEvents.EventCount;
            veryHighAccelerationCount = veryHighAccelerationEvents.EventCount;
            moderateDecelerationCount = moderateDecelerationEvents.EventCount;
            highDecelerationCount = highDecelerationEvents.EventCount;
            veryHighDecelerationCount = veryHighDecelerationEvents.EventCount;

            var directionChangeEvents = DetectDirectionChangeBands(
                gpsPoints,
                thresholdsProfile.CodModerateThresholdDegrees,
                thresholdsProfile.CodHighThresholdDegrees,
                thresholdsProfile.CodVeryHighThresholdDegrees,
                thresholdsProfile.CodMinimumSpeedMps,
                thresholdsProfile.CodConsecutiveSamplesRequired);

            moderateDirectionChangeCount = directionChangeEvents.ModerateCount;
            highDirectionChangeCount = directionChangeEvents.HighCount;
            veryHighDirectionChangeCount = directionChangeEvents.VeryHighCount;
            directionChanges = directionChangeEvents.TotalCount;

            accelerationCount = moderateAccelerationEvents.EventCount + highAccelerationEvents.EventCount + veryHighAccelerationEvents.EventCount;
            decelerationCount = moderateDecelerationEvents.EventCount + highDecelerationEvents.EventCount + veryHighDecelerationEvents.EventCount;
            distanceMeters = totalDistanceMeters;

            foreach (var key in new[]
                     {
                         "distanceMeters", "sprintDistanceMeters", "sprintCount", "maxSpeedMetersPerSecond", "highIntensityTimeSeconds", "highIntensityRunCount",
                         "highSpeedDistanceMeters", "runningDensityMetersPerMinute", "accelerationCount", "decelerationCount", "directionChanges",
                         "moderateAccelerationCount", "highAccelerationCount", "veryHighAccelerationCount", "moderateDecelerationCount", "highDecelerationCount", "veryHighDecelerationCount",
                         "moderateDirectionChangeCount", "highDirectionChangeCount", "veryHighDirectionChangeCount"
                     })
            {
                var metricState = string.Equals(qualityStatus, "Medium", StringComparison.OrdinalIgnoreCase)
                    ? "AvailableWithWarning"
                    : "Available";
                var metricReason = string.Equals(metricState, "AvailableWithWarning", StringComparison.OrdinalIgnoreCase)
                    ? "GPS-derived metric calculated with reduced confidence. Please interpret with caution."
                    : null;
                MarkMetric(key, metricState, metricReason);
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

        var availableMetrics = metricAvailability.Count(entry => string.Equals(entry.Value.State, "Available", StringComparison.OrdinalIgnoreCase) || string.Equals(entry.Value.State, "AvailableWithWarning", StringComparison.OrdinalIgnoreCase));

        return (new TcxFootballCoreMetrics(
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
            moderateAccelerationCount,
            highAccelerationCount,
            veryHighAccelerationCount,
            moderateDecelerationCount,
            highDecelerationCount,
            veryHighDecelerationCount,
            directionChanges,
            moderateDirectionChangeCount,
            highDirectionChangeCount,
            veryHighDirectionChangeCount,
            hrZoneLowSeconds,
            hrZoneMediumSeconds,
            hrZoneHighSeconds,
            trimpEdwards,
            hrRecoveryAfter60Seconds,
            metricAvailability,
            thresholds),
            detectedRuns);
    }

    private static List<TcxDetectedRun> DetectRunsWithConsecutiveSamples(
        IReadOnlyList<(int PointIndex, double StartElapsedSeconds, double EndElapsedSeconds, double Distance, double Speed, double Duration)> segments,
        double thresholdMps,
        string runType)
    {
        const int consecutiveSamplesRequired = 2;
        var runs = new List<TcxDetectedRun>();
        var pendingAbove = new List<int>();
        var currentRun = new List<int>();
        var inRun = false;
        var consecutiveBelow = 0;

        void FinalizeRun()
        {
            if (currentRun.Count == 0)
            {
                return;
            }

            var first = segments[currentRun[0]];
            var last = segments[currentRun[^1]];
            var distanceMeters = currentRun.Sum(sampleIndex => segments[sampleIndex].Distance);
            var topSpeedMetersPerSecond = currentRun.Max(sampleIndex => segments[sampleIndex].Speed);
            var pointIndices = currentRun
                .Select(sampleIndex => segments[sampleIndex].PointIndex)
                .Distinct()
                .ToList();

            var startElapsedSeconds = Math.Max(0, first.StartElapsedSeconds);
            var durationSeconds = Math.Max(0, last.EndElapsedSeconds - startElapsedSeconds);

            runs.Add(new TcxDetectedRun(
                $"{runType}-{runs.Count + 1}",
                runType,
                startElapsedSeconds,
                durationSeconds,
                distanceMeters,
                topSpeedMetersPerSecond,
                pointIndices,
                null,
                Array.Empty<TcxSprintPhase>()));
        }

        for (var sampleIndex = 0; sampleIndex < segments.Count; sampleIndex++)
        {
            var aboveThreshold = segments[sampleIndex].Speed >= thresholdMps;

            if (!inRun)
            {
                if (aboveThreshold)
                {
                    pendingAbove.Add(sampleIndex);
                    if (pendingAbove.Count >= consecutiveSamplesRequired)
                    {
                        inRun = true;
                        currentRun = new List<int>(pendingAbove);
                        pendingAbove.Clear();
                        consecutiveBelow = 0;
                    }
                }
                else
                {
                    pendingAbove.Clear();
                }

                continue;
            }

            if (aboveThreshold)
            {
                currentRun.Add(sampleIndex);
                consecutiveBelow = 0;
                continue;
            }

            consecutiveBelow++;
            if (consecutiveBelow >= consecutiveSamplesRequired)
            {
                FinalizeRun();
                inRun = false;
                pendingAbove.Clear();
                currentRun.Clear();
                consecutiveBelow = 0;
            }
        }

        if (inRun)
        {
            FinalizeRun();
        }

        return runs;
    }

    private enum AccelDecelBand
    {
        None = 0,
        Moderate = 1,
        High = 2,
        VeryHigh = 3
    }

    private enum CodBand
    {
        Moderate,
        High,
        VeryHigh
    }

    private readonly record struct SpeedSample(double ElapsedSeconds, double SpeedMps, double DistanceMeters);

    private readonly record struct AccelWindowSample(
        double ElapsedSeconds,
        double NetAccelerationMps2,
        double DistanceMeters,
        AccelDecelBand AccelerationBand,
        AccelDecelBand DecelerationBand);

    private static List<AccelWindowSample> BuildAccelerationWindowSamples(
        IReadOnlyList<SpeedSample> samples,
        MetricThresholdProfile thresholdsProfile)
    {
        const double expectedWindowSeconds = 2.0;
        const double windowToleranceSeconds = 0.25;

        var windows = new List<AccelWindowSample>();
        for (var index = 2; index < samples.Count; index++)
        {
            var current = samples[index];
            var start = samples[index - 2];
            var elapsedWindowSeconds = current.ElapsedSeconds - start.ElapsedSeconds;
            if (elapsedWindowSeconds <= 0 || Math.Abs(elapsedWindowSeconds - expectedWindowSeconds) > windowToleranceSeconds)
            {
                continue;
            }

            var netAccelerationMps2 = (current.SpeedMps - start.SpeedMps) / elapsedWindowSeconds;
            var passesMinSpeed = current.SpeedMps >= thresholdsProfile.AccelDecelMinimumSpeedMps && start.SpeedMps >= thresholdsProfile.AccelDecelMinimumSpeedMps;

            var accelerationBand = passesMinSpeed
                ? ClassifyAccelerationBand(netAccelerationMps2, thresholdsProfile)
                : AccelDecelBand.None;
            var decelerationBand = passesMinSpeed
                ? ClassifyDecelerationBand(netAccelerationMps2, thresholdsProfile)
                : AccelDecelBand.None;

            windows.Add(new AccelWindowSample(current.ElapsedSeconds, netAccelerationMps2, current.DistanceMeters, accelerationBand, decelerationBand));
        }

        return windows;
    }

    private static AccelDecelBand ClassifyAccelerationBand(double accelerationMps2, MetricThresholdProfile thresholdsProfile)
    {
        if (accelerationMps2 >= thresholdsProfile.VeryHighAccelerationThresholdMps2)
        {
            return AccelDecelBand.VeryHigh;
        }

        if (accelerationMps2 >= thresholdsProfile.HighAccelerationThresholdMps2)
        {
            return AccelDecelBand.High;
        }

        if (accelerationMps2 >= thresholdsProfile.ModerateAccelerationThresholdMps2)
        {
            return AccelDecelBand.Moderate;
        }

        return AccelDecelBand.None;
    }

    private static AccelDecelBand ClassifyDecelerationBand(double accelerationMps2, MetricThresholdProfile thresholdsProfile)
    {
        if (accelerationMps2 <= thresholdsProfile.VeryHighDecelerationThresholdMps2)
        {
            return AccelDecelBand.VeryHigh;
        }

        if (accelerationMps2 <= thresholdsProfile.HighDecelerationThresholdMps2)
        {
            return AccelDecelBand.High;
        }

        if (accelerationMps2 <= thresholdsProfile.ModerateDecelerationThresholdMps2)
        {
            return AccelDecelBand.Moderate;
        }

        return AccelDecelBand.None;
    }

    private static (int EventCount, double DistanceMeters) DetectBandEvents(
        IReadOnlyList<AccelWindowSample> samples,
        AccelDecelBand targetBand,
        Func<AccelWindowSample, AccelDecelBand> bandSelector)
    {
        const int consecutiveNonCandidatesForEnd = 2;
        var eventCount = 0;
        var eventDistanceMeters = 0d;
        var inEvent = false;
        var consecutiveOutsideBand = 0;

        foreach (var sample in samples)
        {
            var isCandidate = bandSelector(sample) == targetBand;

            if (!inEvent)
            {
                if (!isCandidate)
                {
                    continue;
                }

                inEvent = true;
                consecutiveOutsideBand = 0;
                eventDistanceMeters += sample.DistanceMeters;
                continue;
            }

            if (isCandidate)
            {
                eventDistanceMeters += sample.DistanceMeters;
                consecutiveOutsideBand = 0;
                continue;
            }

            consecutiveOutsideBand++;
            if (consecutiveOutsideBand >= consecutiveNonCandidatesForEnd)
            {
                eventCount++;
                inEvent = false;
                consecutiveOutsideBand = 0;
            }
        }

        if (inEvent)
        {
            eventCount++;
        }

        return (eventCount, eventDistanceMeters);
    }


    private static (int JumpCount, int ClusteredJumpCount) CountUnplausibleGpsJumps(IReadOnlyList<TrackpointSnapshot> trackpoints, double outlierSpeedThresholdMps)
    {
        var pointsWithGpsAndTime = trackpoints
            .Where(tp => tp.TimeUtc.HasValue && tp.Latitude.HasValue && tp.Longitude.HasValue)
            .OrderBy(tp => tp.TimeUtc)
            .ToList();

        if (pointsWithGpsAndTime.Count < 2)
        {
            return (0, 0);
        }

        var unplausibleJumpCount = 0;
        var clusteredJumpCount = 0;
        var previousWasJump = false;
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
                if (previousWasJump)
                {
                    clusteredJumpCount++;
                }

                previousWasJump = true;
                continue;
            }

            previousWasJump = false;
        }

        return (unplausibleJumpCount, clusteredJumpCount);
    }


    private sealed record ChannelQualityAssessment(string Status, IReadOnlyList<string> Reasons);
    private sealed record QualityAssessment(string Status, IReadOnlyList<string> Reasons, ChannelQualityAssessment GpsAssessment, ChannelQualityAssessment HeartRateAssessment);
}
