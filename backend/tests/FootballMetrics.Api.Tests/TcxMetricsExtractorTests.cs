using System.Globalization;
using System.Xml.Linq;
using FootballMetrics.Api.Services;
using FluentAssertions;
using Xunit;

namespace FootballMetrics.Api.Tests;

public class TcxMetricsExtractorTests
{
    [Fact]
    public void Mvp03_Ac01_Ac02_Ac03_Extract_ShouldReadBaseMetricsAndPreferCalculatedGpsDistance()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <DistanceMeters>1500</DistanceMeters>
        <Track>
          <Trackpoint>
            <Time>2026-02-16T10:00:00Z</Time>
            <Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position>
            <HeartRateBpm><Value>120</Value></HeartRateBpm>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-02-16T10:01:00Z</Time>
            <Position><LatitudeDegrees>50.0005</LatitudeDegrees><LongitudeDegrees>7.0005</LongitudeDegrees></Position>
            <HeartRateBpm><Value>140</Value></HeartRateBpm>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.ActivityStartTimeUtc.Should().Be(DateTime.Parse("2026-02-16T10:00:00Z", null, DateTimeStyles.AdjustToUniversal));
        summary.DurationSeconds.Should().Be(60);
        summary.TrackpointCount.Should().Be(2);
        summary.HeartRateMinBpm.Should().Be(120);
        summary.HeartRateAverageBpm.Should().Be(130);
        summary.HeartRateMaxBpm.Should().Be(140);
        summary.HasGpsData.Should().BeTrue();
        summary.DistanceMeters.Should().BeGreaterThan(0);
        summary.DistanceSource.Should().Be("CalculatedFromGps");
        summary.FileDistanceMeters.Should().Be(1500);
        summary.DistanceMeters.Should().NotBe(summary.FileDistanceMeters);
        summary.QualityStatus.Should().Be("High");
        summary.QualityReasons.Should().ContainSingle();
    }

    [Fact]
    public void Mvp03_Ac04_Extract_WithoutGpsOrHeartRate_ShouldMarkMissingValuesWithoutFailing()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:02:00Z</Time></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.TrackpointCount.Should().Be(2);
        summary.DurationSeconds.Should().Be(120);
        summary.HasGpsData.Should().BeFalse();
        summary.DistanceMeters.Should().BeNull();
        summary.DistanceSource.Should().Be("NotAvailable");
        summary.HeartRateMinBpm.Should().BeNull();
        summary.HeartRateAverageBpm.Should().BeNull();
        summary.HeartRateMaxBpm.Should().BeNull();
        summary.QualityStatus.Should().Be("Low");
        summary.QualityReasons.Should().Contain(reason => reason.Contains("Heart rate data is mostly missing"));
    }

    [Fact]
    public void Mvp04_Ac02_Ac03_Extract_WithImplausibleGpsJumps_ShouldFlagMediumQualityAndReasons()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint>
            <Time>2026-02-16T10:00:00Z</Time>
            <Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position>
            <HeartRateBpm><Value>130</Value></HeartRateBpm>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-02-16T10:00:01Z</Time>
            <Position><LatitudeDegrees>50.01</LatitudeDegrees><LongitudeDegrees>7.01</LongitudeDegrees></Position>
            <HeartRateBpm><Value>132</Value></HeartRateBpm>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-02-16T10:00:02Z</Time>
            <Position><LatitudeDegrees>50.02</LatitudeDegrees><LongitudeDegrees>7.02</LongitudeDegrees></Position>
            <HeartRateBpm><Value>134</Value></HeartRateBpm>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.QualityStatus.Should().Be("Medium");
        summary.QualityReasons.Should().Contain(reason => reason.Contains("implausible GPS jumps"));
    }
}
