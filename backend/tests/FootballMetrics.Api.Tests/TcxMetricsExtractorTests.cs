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


    [Fact]
    public void Mvp04_Ac02_Extract_WithMostlyMissingGpsPoints_ShouldLowerQualityAndReportGpsCompleteness()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:10Z</Time><HeartRateBpm><Value>122</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:20Z</Time><HeartRateBpm><Value>124</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time><HeartRateBpm><Value>126</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.QualityStatus.Should().Be("Medium");
        summary.QualityReasons.Should().Contain(reason => reason.Contains("GPS coverage is limited"));
    }

    [Fact]
    public void Mvp04_Ac02_Extract_WithMissingTimestamps_ShouldLowerQualityAndReportMissingPoints()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position><HeartRateBpm><Value>122</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position><HeartRateBpm><Value>124</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time><Position><LatitudeDegrees>50.0003</LatitudeDegrees><LongitudeDegrees>7.0003</LongitudeDegrees></Position><HeartRateBpm><Value>126</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.QualityStatus.Should().Be("Medium");
        summary.QualityReasons.Should().Contain(reason => reason.Contains("missing timestamps"));
    }



    [Fact]
    public void Mvp04_Ac01_Scoring_WithSingleMinorIssue_ShouldRemainHigh()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position><HeartRateBpm><Value>122</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:20Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position><HeartRateBpm><Value>124</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time><Position><LatitudeDegrees>50.0003</LatitudeDegrees><LongitudeDegrees>7.0003</LongitudeDegrees></Position><HeartRateBpm><Value>126</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:40Z</Time><Position><LatitudeDegrees>50.0004</LatitudeDegrees><LongitudeDegrees>7.0004</LongitudeDegrees></Position><HeartRateBpm><Value>128</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.QualityStatus.Should().Be("High");
        summary.QualityReasons.Should().Contain(reason => reason.Contains("Some trackpoints are missing timestamps"));
    }

    [Fact]
    public void Mvp04_Ac01_Scoring_WithTwoMinorIssues_ShouldBeMedium()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position><HeartRateBpm><Value>122</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:20Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position><HeartRateBpm><Value>124</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time><Position><LatitudeDegrees>50.0003</LatitudeDegrees><LongitudeDegrees>7.0003</LongitudeDegrees></Position></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:40Z</Time><Position><LatitudeDegrees>50.0004</LatitudeDegrees><LongitudeDegrees>7.0004</LongitudeDegrees></Position><HeartRateBpm><Value>128</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.QualityStatus.Should().Be("Medium");
        summary.QualityReasons.Should().Contain(reason => reason.Contains("missing timestamps"));
        summary.QualityReasons.Should().Contain(reason => reason.Contains("Heart rate data is partially missing"));
    }

    [Fact]
    public void Mvp04_Ac01_Scoring_WithTwoMajorIssues_ShouldBeLow()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:10Z</Time></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:20Z</Time></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:40Z</Time></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.QualityStatus.Should().Be("Low");
        summary.QualityReasons.Should().Contain(reason => reason.Contains("GPS coverage is limited"));
        summary.QualityReasons.Should().Contain(reason => reason.Contains("Heart rate data is mostly missing"));
    }


    [Fact]
    public void R1_01_Ac01_Ac03_Extract_ShouldApplyFootballAdaptiveSmoothingAndCorrectOutlier()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0000</LatitudeDegrees><LongitudeDegrees>7.0000</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:05Z</Time><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position><HeartRateBpm><Value>131</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:06Z</Time><Position><LatitudeDegrees>50.0200</LatitudeDegrees><LongitudeDegrees>7.0200</LongitudeDegrees></Position><HeartRateBpm><Value>132</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:10Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position><HeartRateBpm><Value>133</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:15Z</Time><Position><LatitudeDegrees>50.0003</LatitudeDegrees><LongitudeDegrees>7.0003</LongitudeDegrees></Position><HeartRateBpm><Value>134</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.Smoothing.SelectedStrategy.Should().Be("FootballAdaptiveMedian");
        summary.Smoothing.CorrectedOutlierCount.Should().BeGreaterThan(0);
        summary.Smoothing.SmoothedDistanceMeters.Should().NotBeNull();
        summary.Smoothing.RawDistanceMeters.Should().NotBeNull();
        summary.Smoothing.SmoothedDistanceMeters!.Value.Should().BeLessThan(summary.Smoothing.RawDistanceMeters!.Value);
    }

    [Fact]
    public void R1_01_Ac02_Ac04_Extract_ShouldPreserveShortDirectionChangesAndExposeTrace()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0000</LatitudeDegrees><LongitudeDegrees>7.0000</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:05Z</Time><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0000</LongitudeDegrees></Position><HeartRateBpm><Value>132</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:10Z</Time><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position><HeartRateBpm><Value>134</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:15Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position><HeartRateBpm><Value>136</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:20Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position><HeartRateBpm><Value>138</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.Smoothing.SelectedParameters.Should().ContainKey("AdaptiveTurnThresholdDegrees");
        summary.Smoothing.SmoothedDirectionChanges.Should().BeGreaterThan(0);
        summary.Smoothing.SmoothedDirectionChanges.Should().BeGreaterOrEqualTo(summary.Smoothing.BaselineDirectionChanges);
        summary.Smoothing.SelectedParameters.Should().ContainKey("OutlierDetectionMode");
        summary.Smoothing.SelectedParameters["OutlierDetectionMode"].Should().Be("AdaptiveMadWithAbsoluteCap");
        var effectiveThreshold = double.Parse(summary.Smoothing.SelectedParameters["EffectiveOutlierSpeedThresholdMps"], CultureInfo.InvariantCulture);
        effectiveThreshold.Should().BeGreaterOrEqualTo(6.0);
        effectiveThreshold.Should().BeLessOrEqualTo(12.5);
    }

}
