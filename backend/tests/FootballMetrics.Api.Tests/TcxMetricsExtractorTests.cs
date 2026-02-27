using System.Globalization;
using System.Xml.Linq;
using FootballMetrics.Api.Services;
using FootballMetrics.Api.Models;
using FluentAssertions;
using Xunit;

namespace FootballMetrics.Api.Tests;

public class TcxMetricsExtractorTests
{

    [Fact]
    public void R1_6_01_Ac01_Extract_WithGpsAndHeartRate_ShouldResolveDualMode()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase><Activities><Activity><Lap><Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:10Z</Time><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
        </Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.DataAvailability.Mode.Should().Be("Dual");
        summary.DataAvailability.GpsStatus.Should().Be("Available");
        summary.DataAvailability.HeartRateStatus.Should().Be("Available");
    }

    [Fact]
    public void R1_6_01_Ac01_Ac04_Extract_WithGpsOnlyLowQuality_ShouldResolveGpsOnlyWithReason()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase><Activities><Activity><Lap><Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:10Z</Time><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:20Z</Time></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time></Trackpoint>
        </Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.DataAvailability.Mode.Should().Be("GpsOnly");
        summary.DataAvailability.HeartRateStatus.Should().Be("NotMeasured");
        summary.DataAvailability.GpsStatus.Should().Be("Available");
        summary.DataAvailability.GpsReason.Should().BeNull();
    }


    [Fact]
    public void R1_6_09_Ac01_Ac04_Ac05_Extract_WithMinorGpsJumps_ShouldExposeChannelQualityAndWarningAvailability()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase><Activities><Activity><Lap><Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:01Z</Time><Position><LatitudeDegrees>50.00001</LatitudeDegrees><LongitudeDegrees>7.00001</LongitudeDegrees></Position><HeartRateBpm><Value>121</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:02Z</Time><Position><LatitudeDegrees>50.00008</LatitudeDegrees><LongitudeDegrees>7.00008</LongitudeDegrees></Position><HeartRateBpm><Value>122</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:03Z</Time><Position><LatitudeDegrees>50.00015</LatitudeDegrees><LongitudeDegrees>7.00015</LongitudeDegrees></Position><HeartRateBpm><Value>123</Value></HeartRateBpm></Trackpoint>
        </Track></Lap></Activity></Activities></TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.DataAvailability.GpsQualityStatus.Should().NotBeNullOrWhiteSpace();
        summary.DataAvailability.HeartRateQualityStatus.Should().NotBeNullOrWhiteSpace();
        summary.CoreMetrics.MetricAvailability["distanceMeters"].State.Should().BeOneOf("Available", "AvailableWithWarning");
    }

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
    public void R1_5_02_Ac01_Ac02_Extract_ShouldBuildAggregatesForOneTwoAndFiveMinuteWindows()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0000</LatitudeDegrees><LongitudeDegrees>7.0000</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:45Z</Time><Position><LatitudeDegrees>50.0003</LatitudeDegrees><LongitudeDegrees>7.0003</LongitudeDegrees></Position><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:01:50Z</Time><Position><LatitudeDegrees>50.0006</LatitudeDegrees><LongitudeDegrees>7.0006</LongitudeDegrees></Position><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:03:20Z</Time><Position><LatitudeDegrees>50.0010</LatitudeDegrees><LongitudeDegrees>7.0010</LongitudeDegrees></Position><HeartRateBpm><Value>155</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:05:00Z</Time><Position><LatitudeDegrees>50.0013</LatitudeDegrees><LongitudeDegrees>7.0013</LongitudeDegrees></Position><HeartRateBpm><Value>148</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.IntervalAggregates.Should().Contain(item => item.WindowMinutes == 1);
        summary.IntervalAggregates.Should().Contain(item => item.WindowMinutes == 2);
        summary.IntervalAggregates.Should().Contain(item => item.WindowMinutes == 5);

        var oneMinuteAggregates = summary.IntervalAggregates
            .Where(item => item.WindowMinutes == 1)
            .ToList();

        oneMinuteAggregates.Should().NotBeEmpty();
        oneMinuteAggregates.Should().OnlyContain(item => item.CoreMetrics != null);
        oneMinuteAggregates.Should().Contain(item => item.CoreMetrics.DistanceMeters.HasValue || item.CoreMetrics.TrainingImpulseEdwards.HasValue);
    }

    [Fact]
    public void R1_5_02_Ac03_Ac04_Extract_ShouldExposeWindowDurationForIrregularFinalWindow()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0000</LatitudeDegrees><LongitudeDegrees>7.0000</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:15Z</Time><Position><LatitudeDegrees>50.0001</LatitudeDegrees><LongitudeDegrees>7.0001</LongitudeDegrees></Position><HeartRateBpm><Value>132</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:02:40Z</Time><Position><LatitudeDegrees>50.0002</LatitudeDegrees><LongitudeDegrees>7.0002</LongitudeDegrees></Position><HeartRateBpm><Value>135</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        var oneMinuteWindows = summary.IntervalAggregates.Where(item => item.WindowMinutes == 1).ToList();
        oneMinuteWindows.Should().NotBeEmpty();

        var lastWindow = oneMinuteWindows.OrderBy(item => item.WindowIndex).Last();
        lastWindow.WindowDurationSeconds.Should().BeGreaterThan(0);
        lastWindow.WindowDurationSeconds.Should().BeLessThan(60);
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

        summary.Smoothing.SelectedStrategy.Should().Be("AdaptiveMedian");
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


    [Fact]
    public void R1_6_15_Ac01_Ac03_Ac04_Extract_ShouldRequireTwoConsecutiveSamplesToStartRunForSprintAndHighIntensity()
    {
        var speedsMps = new[] { 7.4, 3.0, 7.5, 7.6, 3.0, 3.0, 6.0, 6.1, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.SprintCount.Should().Be(1);
        summary.CoreMetrics.HighIntensityRunCount.Should().Be(2);
    }

    [Fact]
    public void R1_6_15_Ac04_Extract_ShouldExposeDetectedRunsAsSingleSourceForUi()
    {
        var speedsMps = new[] { 7.4, 3.0, 7.5, 7.6, 3.0, 3.0, 6.0, 6.1, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.DetectedRuns.Should().HaveCount(2);
        summary.DetectedRuns.Should().OnlyContain(run => run.RunType == "highIntensity");
        summary.DetectedRuns.Sum(run => run.SprintPhases.Count).Should().Be(1);
        summary.DetectedRuns.Should().OnlyContain(run => run.DistanceMeters > 0);
        summary.DetectedRuns.Should().OnlyContain(run => run.PointIndices.Count >= 2);
    }

    [Fact]
    public void R1_6_16_Ac01_Ac02_Ac03_Ac04_Extract_ShouldCreateHierarchicalHsrRunsWithSprintSubPhases()
    {
        var speedsMps = new[] { 6.0, 6.1, 7.5, 7.6, 6.2, 6.1, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        var highIntensityRuns = summary.DetectedRuns.Where(run => run.RunType == "highIntensity").ToList();

        highIntensityRuns.Should().HaveCount(1);

        var highIntensityRun = highIntensityRuns.Single();

        highIntensityRun.SprintPhases.Should().HaveCount(1);
        highIntensityRun.SprintPhases[0].ParentRunId.Should().Be(highIntensityRun.RunId);
        highIntensityRun.SprintPhases[0].DistanceMeters.Should().BeLessThanOrEqualTo(highIntensityRun.DistanceMeters);
        summary.DetectedRuns.Should().OnlyContain(run => run.ParentRunId == null);
    }


    [Fact]
    public void R1_6_16_Qa_Extract_ShouldUseTimestampBasedRunTimingNotPointIndex()
    {
        var speedsMps = new[] { 0.8, 0.9, 6.2, 6.3, 0.7, 0.6 };
        var durationsSeconds = new[] { 10.0, 10.0, 10.0, 10.0, 10.0, 10.0 };
        var doc = BuildGpsDocumentFromSegmentSpeedsAndDurations(speedsMps, durationsSeconds);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        var highIntensityRuns = summary.DetectedRuns.Where(run => run.RunType == "highIntensity").ToList();
        highIntensityRuns.Should().HaveCount(1);

        var run = highIntensityRuns.Single();
        run.StartElapsedSeconds.Should().Be(20);
        run.DurationSeconds.Should().Be(20);
    }


    [Fact]
    public void R1_6_16_Ac01_Ac03_Ac04_Extract_ShouldKeepOneHsrRunAcrossSingleBelowThresholdGapWithSevenSamples()
    {
        var speedsMps = new[] { 6.0, 6.1, 6.2, 3.0, 7.5, 6.0, 7.4, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        var highIntensityRuns = summary.DetectedRuns.Where(run => run.RunType == "highIntensity").ToList();
        highIntensityRuns.Should().HaveCount(1);

        var run = highIntensityRuns.Single();
        run.PointIndices.Should().HaveCount(6);
        run.StartElapsedSeconds.Should().Be(0);
        run.DurationSeconds.Should().Be(7);
        run.SprintPhases.Should().BeEmpty();
    }

    [Fact]
    public void R1_6_16_Qa_Extract_ShouldUseOnlyDetectedSprintPhaseDistanceForSprintDistanceMetric()
    {
        var speedsMps = new[] { 6.0, 6.1, 6.2, 3.0, 7.5, 7.6, 3.0, 3.0, 7.5, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.SprintCount.Should().Be(1);
        summary.DetectedRuns.Should().HaveCount(1);
        var highIntensityRun = summary.DetectedRuns.Single();
        highIntensityRun.SprintPhases.Should().HaveCount(1);

        var nestedSprintPhaseDistance = highIntensityRun.SprintPhases.Sum(phase => phase.DistanceMeters);
        summary.CoreMetrics.SprintDistanceMeters.Should().NotBeNull();
        summary.CoreMetrics.SprintDistanceMeters!.Value.Should().BeApproximately(nestedSprintPhaseDistance, 0.001d);
    }


    [Fact]
    public void R1_6_16_Qa_Extract_ShouldDetectSingleShortHsrRunWithoutSprintPhaseWhenOnlyOneSprintSampleExists()
    {
        var speedsMps = new[] { 6.0, 7.5, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.HighIntensityRunCount.Should().Be(1);
        summary.CoreMetrics.SprintCount.Should().Be(0);
        summary.CoreMetrics.SprintDistanceMeters.Should().Be(0);

        var highIntensityRuns = summary.DetectedRuns.Where(run => run.RunType == "highIntensity").ToList();
        highIntensityRuns.Should().HaveCount(1);

        var run = highIntensityRuns.Single();
        run.StartElapsedSeconds.Should().Be(0);
        run.DurationSeconds.Should().Be(2);
        run.PointIndices.Should().Equal(new[] { 0, 1 });
        run.SprintPhases.Should().BeEmpty();
    }


    [Fact]
    public void R1_6_16_Qa_Extract_ShouldKeepSingleHsrRunAndCreateNoSprintPhaseForIsolatedSprintSamples()
    {
        var speedsMps = new[] { 6.0, 6.1, 7.5, 3.0, 7.6, 6.0, 3.0, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.HighIntensityRunCount.Should().Be(1);
        summary.CoreMetrics.SprintCount.Should().Be(0);
        summary.CoreMetrics.SprintDistanceMeters.Should().Be(0);

        var highIntensityRuns = summary.DetectedRuns.Where(run => run.RunType == "highIntensity").ToList();
        highIntensityRuns.Should().HaveCount(1);
        highIntensityRuns.Single().SprintPhases.Should().BeEmpty();
    }

    [Fact]
    public void R1_6_15_Ac02_Ac06_Ac07_Ac08_Extract_ShouldKeepRunOpenUntilTwoConsecutiveBelowThresholdSamplesAndPreserveDistance()
    {
        var speedsMps = new[] { 7.5, 7.6, 6.5, 7.4, 3.0, 7.5, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.SprintCount.Should().Be(1);
        summary.CoreMetrics.HighIntensityRunCount.Should().Be(1);
        summary.CoreMetrics.SprintDistanceMeters.Should().BeApproximately(30d, 1.0d);
        summary.CoreMetrics.HighSpeedDistanceMeters.Should().BeApproximately(36.5d, 1.0d);
        summary.CoreMetrics.MaxSpeedMetersPerSecond.Should().BeGreaterThan(7.5d);
    }


    [Fact]
    public void R1_6_18_Ac01_Ac02_Ac03_Ac04_Ac05_Ac07_Extract_ShouldIgnoreIsolatedHighIntensitySampleForDistanceAndTime()
    {
        var speedsMps = new[] { 3.0, 6.0, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.HighIntensityRunCount.Should().Be(0);
        summary.CoreMetrics.HighSpeedDistanceMeters.Should().Be(0);
        summary.CoreMetrics.HighIntensityTimeSeconds.Should().Be(0);
        summary.DetectedRuns.Should().BeEmpty();
    }

    [Fact]
    public void R1_6_18_Ac01_Ac02_Ac03_Ac05_Ac06_Ac08_Extract_ShouldKeepDistanceAndTimeForValidHighIntensityRun()
    {
        var speedsMps = new[] { 6.0, 6.1, 3.0, 3.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.HighIntensityRunCount.Should().Be(1);
        summary.CoreMetrics.HighSpeedDistanceMeters.Should().BeApproximately(12.1d, 1.0d);
        summary.CoreMetrics.HighIntensityTimeSeconds.Should().Be(2);
        summary.DetectedRuns.Should().HaveCount(1);
        summary.DetectedRuns.Single().DistanceMeters.Should().BeApproximately(summary.CoreMetrics.HighSpeedDistanceMeters!.Value, 0.001d);
    }

    [Fact]
    public void R1_6_19_Ac01_Ac02_Ac03_Ac04_Ac05_Ac06_Ac07_Extract_WithSingleAccelerationSpike_ShouldNotStartAccelerationEvent()
    {
        var speedsMps = new[] { 1.0, 4.0, 1.0, 1.0, 1.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.AccelerationCount.Should().Be(0);
        summary.CoreMetrics.DecelerationCount.Should().Be(0);
    }

    [Fact]
    public void R1_6_19_Ac01_Ac02_Ac03_Ac04_Ac06_Ac08_Ac09_Extract_WithTwoConsecutiveAccelerationSamples_ShouldCreateOneAccelerationEvent()
    {
        var speedsMps = new[] { 1.0, 3.2, 5.4, 5.4, 5.4 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.AccelerationCount.Should().Be(1);
    }

    [Fact]
    public void R1_6_19_Ac01_Ac02_Ac03_Ac04_Ac05_Ac06_Extract_WithSingleDecelerationSpike_ShouldNotStartDecelerationEvent()
    {
        var speedsMps = new[] { 6.0, 3.5, 6.0, 6.0, 6.0 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.AccelerationCount.Should().Be(0);
        summary.CoreMetrics.DecelerationCount.Should().Be(0);
    }

    [Fact]
    public void R1_6_19_Ac01_Ac02_Ac03_Ac04_Ac06_Ac08_Ac09_Extract_WithTwoConsecutiveDecelerationSamples_ShouldCreateOneDecelerationEvent()
    {
        var speedsMps = new[] { 6.0, 3.7, 1.2, 1.2, 1.2 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.DecelerationCount.Should().Be(1);
    }

    [Fact]
    public void R1_6_19_Ac04_Extract_WithSingleBelowThresholdSampleInsideEvent_ShouldKeepEventOpen()
    {
        var speedsMps = new[] { 1.0, 3.2, 5.4, 6.0, 8.2, 8.2 };
        var doc = BuildOneHertzGpsDocumentFromSegmentSpeeds(speedsMps);

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.CoreMetrics.AccelerationCount.Should().Be(1);
    }

    [Fact]
    public void R1_03_Ac01_Ac02_Ac05_Extract_ShouldCalculateFootballCoreMetricsWithDocumentedThresholdsAndExtendedMetrics()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:01Z</Time><Position><LatitudeDegrees>50.00008</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>132</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:02Z</Time><Position><LatitudeDegrees>50.00016</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>134</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:03Z</Time><Position><LatitudeDegrees>50.00019</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>136</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.CoreMetrics.IsAvailable.Should().BeTrue();
        summary.CoreMetrics.DistanceMeters.Should().Be(summary.DistanceMeters);
        summary.CoreMetrics.SprintDistanceMeters.Should().BeGreaterOrEqualTo(0);
        summary.CoreMetrics.SprintCount.Should().NotBeNull();
        summary.CoreMetrics.MaxSpeedMetersPerSecond.Should().BeGreaterThan(7.0);
        summary.CoreMetrics.HighIntensityTimeSeconds.Should().BeGreaterOrEqualTo(0);
        summary.CoreMetrics.HighIntensityRunCount.Should().NotBeNull();
        summary.CoreMetrics.HighSpeedDistanceMeters.Should().BeGreaterOrEqualTo(0);
        summary.CoreMetrics.RunningDensityMetersPerMinute.Should().BeGreaterThan(0);
        summary.CoreMetrics.AccelerationCount.Should().NotBeNull();
        summary.CoreMetrics.DecelerationCount.Should().NotBeNull();
        summary.CoreMetrics.HeartRateZoneLowSeconds.Should().NotBeNull();
        summary.CoreMetrics.HeartRateZoneMediumSeconds.Should().NotBeNull();
        summary.CoreMetrics.HeartRateZoneHighSeconds.Should().NotBeNull();
        summary.CoreMetrics.TrainingImpulseEdwards.Should().BeGreaterThan(0);
        summary.CoreMetrics.Thresholds["SprintSpeedThresholdMps"].Should().Be("7.2");
        summary.CoreMetrics.Thresholds["HighIntensitySpeedThresholdMps"].Should().Be("5.6");
        summary.CoreMetrics.Thresholds["AccelerationThresholdMps2"].Should().Be("2.0");
        summary.CoreMetrics.Thresholds["DecelerationThresholdMps2"].Should().Be("-2.0");
    }

    [Fact]
    public void R1_03_Ac03_Ac04_Extract_ShouldMarkGpsMetricsAsUnusableWhenQualityIsInsufficient()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:10Z</Time></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:20Z</Time></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.QualityStatus.Should().Be("Low");
        summary.CoreMetrics.IsAvailable.Should().BeFalse();
        summary.CoreMetrics.UnavailableReason.Should().Contain("No core metric");
        summary.CoreMetrics.DistanceMeters.Should().BeNull();
        summary.CoreMetrics.SprintDistanceMeters.Should().BeNull();
        summary.CoreMetrics.SprintCount.Should().BeNull();
        summary.CoreMetrics.MaxSpeedMetersPerSecond.Should().BeNull();
        summary.CoreMetrics.HighIntensityTimeSeconds.Should().BeNull();
        summary.CoreMetrics.HighSpeedDistanceMeters.Should().BeNull();
        summary.CoreMetrics.RunningDensityMetersPerMinute.Should().BeNull();
        summary.CoreMetrics.AccelerationCount.Should().BeNull();
        summary.CoreMetrics.DecelerationCount.Should().BeNull();
        summary.CoreMetrics.HeartRateZoneLowSeconds.Should().BeNull();
        summary.CoreMetrics.HeartRateZoneMediumSeconds.Should().BeNull();
        summary.CoreMetrics.HeartRateZoneHighSeconds.Should().BeNull();
        summary.CoreMetrics.TrainingImpulseEdwards.Should().BeNull();
        summary.CoreMetrics.MetricAvailability["distanceMeters"].State.Should().Be("NotUsable");
        summary.CoreMetrics.MetricAvailability["heartRateZoneLowSeconds"].State.Should().Be("NotMeasured");
    }

    [Fact]
    public void R1_04_Ac01_Ac02_Ac03_Ac04_Extract_WithoutGpsButWithHeartRate_ShouldProvideFallbackMetricsAndReasons()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:01:00Z</Time><HeartRateBpm><Value>135</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc);

        summary.CoreMetrics.IsAvailable.Should().BeTrue();
        summary.CoreMetrics.HeartRateZoneLowSeconds.Should().NotBeNull();
        summary.CoreMetrics.TrainingImpulseEdwards.Should().NotBeNull();
        summary.CoreMetrics.DistanceMeters.Should().BeNull();
        summary.CoreMetrics.SprintCount.Should().BeNull();
        summary.CoreMetrics.MetricAvailability["distanceMeters"].State.Should().Be("NotMeasured");
        summary.CoreMetrics.MetricAvailability["distanceMeters"].Reason.Should().Contain("not recorded");
        summary.CoreMetrics.MetricAvailability["heartRateZoneLowSeconds"].State.Should().Be("Available");
    }



    [Fact]
    public void R2_10_GoldenMaster_Extract_ShouldMatchKnownSnapshotForReferenceInput()
    {
        var doc = XDocument.Parse(@"<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Id>2026-02-16T10:00:00Z</Id>
      <Lap>
        <DistanceMeters>520</DistanceMeters>
        <Track>
          <Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0000</LatitudeDegrees><LongitudeDegrees>7.0000</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:10Z</Time><Position><LatitudeDegrees>50.0003</LatitudeDegrees><LongitudeDegrees>7.0003</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:20Z</Time><Position><LatitudeDegrees>50.0006</LatitudeDegrees><LongitudeDegrees>7.0006</LongitudeDegrees></Position><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-02-16T10:00:30Z</Time><Position><LatitudeDegrees>50.0009</LatitudeDegrees><LongitudeDegrees>7.0009</LongitudeDegrees></Position><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>");

        var summary = TcxMetricsExtractor.Extract(doc, TcxSmoothingFilters.Raw, MetricThresholdProfile.CreateDefault());

        summary.TrackpointCount.Should().Be(4);
        summary.DurationSeconds.Should().Be(30);
        summary.HeartRateMinBpm.Should().Be(120);
        summary.HeartRateAverageBpm.Should().Be(135);
        summary.HeartRateMaxBpm.Should().Be(150);
        summary.DistanceSource.Should().Be("CalculatedFromGps");
        summary.DistanceMeters.Should().NotBeNull();
        summary.DistanceMeters!.Value.Should().BeInRange(118d, 126d);
        summary.QualityStatus.Should().Be("High");
        summary.CoreMetrics.IsAvailable.Should().BeTrue();
        summary.CoreMetrics.MaxSpeedMetersPerSecond.Should().NotBeNull();
        summary.CoreMetrics.MaxSpeedMetersPerSecond!.Value.Should().BeInRange(3.8d, 4.5d);
        summary.CoreMetrics.SprintCount.Should().Be(0);
    }

    private static XDocument BuildGpsDocumentFromSegmentSpeedsAndDurations(IReadOnlyList<double> segmentSpeedsMetersPerSecond, IReadOnlyList<double> segmentDurationsSeconds)
    {
        segmentSpeedsMetersPerSecond.Count.Should().Be(segmentDurationsSeconds.Count);

        const double metersPerDegreeLatitude = 111_320d;
        var timestamp = DateTime.Parse("2026-02-16T10:00:00Z", null, DateTimeStyles.AdjustToUniversal);
        var latitude = 50.0d;

        var xml = "<TrainingCenterDatabase><Activities><Activity><Lap><Track>";
        xml += $"<Trackpoint><Time>{timestamp:O}</Time><Position><LatitudeDegrees>{latitude.ToString(CultureInfo.InvariantCulture)}</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>";

        for (var index = 0; index < segmentSpeedsMetersPerSecond.Count; index++)
        {
            var speed = segmentSpeedsMetersPerSecond[index];
            var duration = segmentDurationsSeconds[index];
            timestamp = timestamp.AddSeconds(duration);
            latitude += (speed * duration) / metersPerDegreeLatitude;
            xml += $"<Trackpoint><Time>{timestamp:O}</Time><Position><LatitudeDegrees>{latitude.ToString(CultureInfo.InvariantCulture)}</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>";
        }

        xml += "</Track></Lap></Activity></Activities></TrainingCenterDatabase>";
        return XDocument.Parse(xml);
    }


    private static XDocument BuildOneHertzGpsDocumentFromSegmentSpeeds(IReadOnlyList<double> segmentSpeedsMetersPerSecond)
    {
        const double metersPerDegreeLatitude = 111_320d;
        var timestamp = DateTime.Parse("2026-02-16T10:00:00Z", null, DateTimeStyles.AdjustToUniversal);
        var latitude = 50.0d;

        var xml = "<TrainingCenterDatabase><Activities><Activity><Lap><Track>";
        xml += $"<Trackpoint><Time>{timestamp:O}</Time><Position><LatitudeDegrees>{latitude.ToString(CultureInfo.InvariantCulture)}</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>";

        foreach (var speed in segmentSpeedsMetersPerSecond)
        {
            timestamp = timestamp.AddSeconds(1);
            latitude += speed / metersPerDegreeLatitude;
            xml += $"<Trackpoint><Time>{timestamp:O}</Time><Position><LatitudeDegrees>{latitude.ToString(CultureInfo.InvariantCulture)}</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>";
        }

        xml += "</Track></Lap></Activity></Activities></TrainingCenterDatabase>";
        return XDocument.Parse(xml);
    }

}
