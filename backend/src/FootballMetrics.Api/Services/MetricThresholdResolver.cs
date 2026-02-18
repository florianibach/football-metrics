using System.Globalization;
using System.Xml.Linq;
using FootballMetrics.Api.Models;
using FootballMetrics.Api.Repositories;

namespace FootballMetrics.Api.Services;

public class MetricThresholdResolver : IMetricThresholdResolver
{
    private readonly ITcxUploadRepository _repository;

    public MetricThresholdResolver(ITcxUploadRepository repository)
    {
        _repository = repository;
    }

    public async Task<MetricThresholdProfile> ResolveEffectiveAsync(MetricThresholdProfile baseProfile, CancellationToken cancellationToken = default)
    {
        var uploads = await _repository.ListAsync(cancellationToken);
        var stats = uploads
            .Select(upload => TryGetSessionAdaptiveStats(upload.RawFileContent))
            .Where(item => item is not null)
            .Select(item => item!)
            .ToList();

        var maxSpeedObserved = stats.Count > 0 ? stats.Max(item => item.MaxSpeedMps) : (double?)null;
        var maxHeartRateObserved = stats.Count > 0 ? stats.Max(item => item.MaxHeartRateBpm) : (int?)null;

        var effectiveMaxSpeed = string.Equals(baseProfile.MaxSpeedMode, MetricThresholdModes.Adaptive, StringComparison.OrdinalIgnoreCase) && maxSpeedObserved.HasValue
            ? maxSpeedObserved.Value
            : baseProfile.MaxSpeedMps;

        var effectiveMaxHeartRate = string.Equals(baseProfile.MaxHeartRateMode, MetricThresholdModes.Adaptive, StringComparison.OrdinalIgnoreCase) && maxHeartRateObserved.HasValue
            ? maxHeartRateObserved.Value
            : baseProfile.MaxHeartRateBpm;

        return new MetricThresholdProfile
        {
            MaxSpeedMps = Math.Clamp(Math.Round(baseProfile.MaxSpeedMps, 2), 4.0, 12.0),
            MaxSpeedMode = NormalizeMode(baseProfile.MaxSpeedMode),
            MaxHeartRateBpm = Math.Clamp(baseProfile.MaxHeartRateBpm, 120, 240),
            MaxHeartRateMode = NormalizeMode(baseProfile.MaxHeartRateMode),
            SprintSpeedPercentOfMaxSpeed = Math.Clamp(Math.Round(baseProfile.SprintSpeedPercentOfMaxSpeed, 1), 70, 100),
            HighIntensitySpeedPercentOfMaxSpeed = Math.Clamp(Math.Round(baseProfile.HighIntensitySpeedPercentOfMaxSpeed, 1), 40, 95),
            AccelerationThresholdMps2 = Math.Clamp(Math.Round(baseProfile.AccelerationThresholdMps2, 2), 0.5, 6.0),
            DecelerationThresholdMps2 = Math.Clamp(Math.Round(baseProfile.DecelerationThresholdMps2, 2), -6.0, -0.5),
            EffectiveMaxSpeedMps = Math.Clamp(Math.Round(effectiveMaxSpeed, 2), 4.0, 12.0),
            EffectiveMaxHeartRateBpm = Math.Clamp(effectiveMaxHeartRate, 120, 240),
            Version = baseProfile.Version,
            UpdatedAtUtc = baseProfile.UpdatedAtUtc
        };
    }

    private static string NormalizeMode(string? value)
        => MetricThresholdModes.Supported.FirstOrDefault(mode => string.Equals(mode, value, StringComparison.OrdinalIgnoreCase))
           ?? MetricThresholdModes.Fixed;

    private sealed record SessionAdaptiveStats(double MaxSpeedMps, int MaxHeartRateBpm);

    private static SessionAdaptiveStats? TryGetSessionAdaptiveStats(byte[] rawFileContent)
    {
        if (rawFileContent.Length == 0)
        {
            return null;
        }

        try
        {
            using var stream = new MemoryStream(rawFileContent, writable: false);
            var document = XDocument.Load(stream);
            XNamespace tcxNs = "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2";

            var points = document.Descendants(tcxNs + "Trackpoint")
                .Select(tp => new
                {
                    TimeUtc = DateTime.TryParse(tp.Element(tcxNs + "Time")?.Value, null, DateTimeStyles.RoundtripKind, out var timestamp)
                        ? (DateTime?)timestamp
                        : null,
                    Latitude = double.TryParse(tp.Element(tcxNs + "Position")?.Element(tcxNs + "LatitudeDegrees")?.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat)
                        ? (double?)lat
                        : null,
                    Longitude = double.TryParse(tp.Element(tcxNs + "Position")?.Element(tcxNs + "LongitudeDegrees")?.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var lon)
                        ? (double?)lon
                        : null,
                    HeartRateBpm = int.TryParse(tp.Element(tcxNs + "HeartRateBpm")?.Element(tcxNs + "Value")?.Value, out var hr)
                        ? (int?)hr
                        : null
                })
                .Where(tp => tp.TimeUtc.HasValue)
                .OrderBy(tp => tp.TimeUtc)
                .ToList();

            var gpsPoints = points.Where(tp => tp.Latitude.HasValue && tp.Longitude.HasValue).ToList();
            if (gpsPoints.Count < 2)
            {
                return null;
            }

            var maxSpeed = 0d;
            for (var index = 1; index < gpsPoints.Count; index++)
            {
                var previous = gpsPoints[index - 1];
                var current = gpsPoints[index];
                var elapsedSeconds = (current.TimeUtc!.Value - previous.TimeUtc!.Value).TotalSeconds;
                if (elapsedSeconds <= 0)
                {
                    continue;
                }

                var distanceMeters = HaversineMeters(previous.Latitude!.Value, previous.Longitude!.Value, current.Latitude!.Value, current.Longitude!.Value);
                var speed = distanceMeters / elapsedSeconds;
                if (speed > maxSpeed)
                {
                    maxSpeed = speed;
                }
            }

            var maxHeartRate = points.Where(tp => tp.HeartRateBpm.HasValue).Select(tp => tp.HeartRateBpm!.Value).DefaultIfEmpty(0).Max();
            if (maxSpeed <= 0 && maxHeartRate <= 0)
            {
                return null;
            }

            return new SessionAdaptiveStats(maxSpeed <= 0 ? 4.0 : maxSpeed, maxHeartRate <= 0 ? 120 : maxHeartRate);
        }
        catch
        {
            return null;
        }
    }

    private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadius = 6371000.0;
        static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2)
                + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) * Math.Pow(Math.Sin(dLon / 2), 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadius * c;
    }
}
