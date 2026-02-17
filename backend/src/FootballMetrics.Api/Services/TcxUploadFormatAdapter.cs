using System.Xml;
using System.Xml.Linq;
using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Services;

public sealed class TcxUploadFormatAdapter : IUploadFormatAdapter
{
    public string FormatKey => "TCX";

    public IReadOnlyCollection<string> SupportedExtensions => new[] { ".tcx" };

    public async Task<UploadParseResult> ParseAsync(byte[] rawFileBytes, CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = new MemoryStream(rawFileBytes, writable: false);
            var document = await XDocument.LoadAsync(stream, LoadOptions.None, cancellationToken);
            var rootName = document.Root?.Name.LocalName;

            if (!string.Equals(rootName, "TrainingCenterDatabase", StringComparison.OrdinalIgnoreCase))
            {
                return UploadParseResult.Failure("File content is invalid. Expected a TCX TrainingCenterDatabase document. Please export the file again from your device.");
            }

            var hasActivities = document
                .Descendants()
                .Any(node => string.Equals(node.Name.LocalName, "Activity", StringComparison.OrdinalIgnoreCase));

            if (!hasActivities)
            {
                return UploadParseResult.Failure("File appears incomplete. No Activity section found. Please verify the export includes workout data.");
            }

            var hasTrackpoints = document
                .Descendants()
                .Any(node => string.Equals(node.Name.LocalName, "Trackpoint", StringComparison.OrdinalIgnoreCase));

            if (!hasTrackpoints)
            {
                return UploadParseResult.Failure("File appears incomplete. No Trackpoint entries found. Please export the workout with detailed points.");
            }

            var summary = TcxMetricsExtractor.Extract(document);
            var canonicalActivity = new CanonicalActivity(
                SourceFormat: FormatKey,
                ActivityStartTimeUtc: summary.ActivityStartTimeUtc,
                DurationSeconds: summary.DurationSeconds,
                TrackpointCount: summary.TrackpointCount,
                HasGpsData: summary.HasGpsData,
                HeartRateMinBpm: summary.HeartRateMinBpm,
                HeartRateAverageBpm: summary.HeartRateAverageBpm,
                HeartRateMaxBpm: summary.HeartRateMaxBpm,
                DistanceMeters: summary.DistanceMeters,
                QualityStatus: summary.QualityStatus);

            return UploadParseResult.Success(summary, canonicalActivity);
        }
        catch (XmlException)
        {
            return UploadParseResult.Failure("File is unreadable or corrupted XML. Please open the file in your exporter and create a new TCX export.");
        }
        catch (InvalidDataException)
        {
            return UploadParseResult.Failure("File could not be read. Please check the file and upload a valid TCX export.");
        }
    }
}
