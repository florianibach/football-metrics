using System.Globalization;
using System.Xml.Linq;
using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public static class TcxMetricsExtractor
{
    private const double EarthRadiusMeters = 6_371_000;

    public static TcxActivitySummary Extract(XDocument document)
    {
        var trackpoints = document
            .Descendants()
            .Where(node => string.Equals(node.Name.LocalName, "Trackpoint", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var startTime = ResolveStartTimeUtc(document, trackpoints);
        var durationSeconds = ResolveDurationSeconds(trackpoints);

        var heartRates = trackpoints
            .Select(tp => ParseInt(tp
                .Descendants()
                .FirstOrDefault(node => string.Equals(node.Name.LocalName, "Value", StringComparison.OrdinalIgnoreCase))?.Value))
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .ToList();

        var gpsPoints = trackpoints
            .Select(tp =>
            {
                var position = tp.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "Position", StringComparison.OrdinalIgnoreCase));
                if (position is null)
                {
                    return (Latitude: (double?)null, Longitude: (double?)null);
                }

                return (
                    Latitude: ParseDouble(position.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "LatitudeDegrees", StringComparison.OrdinalIgnoreCase))?.Value),
                    Longitude: ParseDouble(position.Descendants().FirstOrDefault(node => string.Equals(node.Name.LocalName, "LongitudeDegrees", StringComparison.OrdinalIgnoreCase))?.Value)
                );
            })
            .Where(point => point.Latitude.HasValue && point.Longitude.HasValue)
            .Select(point => (point.Latitude!.Value, point.Longitude!.Value))
            .ToList();

        var calculatedDistanceMeters = gpsPoints.Count < 2
            ? (double?)null
            : CalculateDistanceMeters(gpsPoints);

        var fileDistanceMeters = document
            .Descendants()
            .Where(node => string.Equals(node.Name.LocalName, "DistanceMeters", StringComparison.OrdinalIgnoreCase))
            .Select(node => ParseDouble(node.Value))
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .DefaultIfEmpty()
            .Sum();

        var hasFileDistance = fileDistanceMeters > 0;
        var finalDistance = calculatedDistanceMeters ?? (hasFileDistance ? fileDistanceMeters : null);
        var source = calculatedDistanceMeters.HasValue ? "CalculatedFromGps" : (hasFileDistance ? "ProvidedByFile" : "NotAvailable");

        return new TcxActivitySummary(
            startTime,
            durationSeconds,
            trackpoints.Count,
            heartRates.Count == 0 ? null : heartRates.Min(),
            heartRates.Count == 0 ? null : (int?)Math.Round(heartRates.Average()),
            heartRates.Count == 0 ? null : heartRates.Max(),
            finalDistance,
            gpsPoints.Count > 0,
            hasFileDistance ? fileDistanceMeters : null,
            source);
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
}
