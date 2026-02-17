using FootballMetrics.Api.Services;
using FluentAssertions;
using Xunit;

namespace FootballMetrics.Api.Tests;

public class TcxUploadFormatAdapterTests
{
    private readonly TcxUploadFormatAdapter _adapter = new();

    [Fact]
    public async Task R1_05_Ac01_Ac04_TcxAdapter_ParseAsync_ShouldReturnCanonicalActivityMapping()
    {
        const string tcx = "<TrainingCenterDatabase><Activities><Activity><Id>2026-02-16T10:00:00Z</Id><Lap><DistanceMeters>2000</DistanceMeters><Track><Trackpoint><Time>2026-02-16T10:00:00Z</Time><Position><LatitudeDegrees>50.0</LatitudeDegrees><LongitudeDegrees>7.0</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint><Trackpoint><Time>2026-02-16T10:01:30Z</Time><Position><LatitudeDegrees>50.0005</LatitudeDegrees><LongitudeDegrees>7.0005</LongitudeDegrees></Position><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>";

        var result = await _adapter.ParseAsync(System.Text.Encoding.UTF8.GetBytes(tcx), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.ErrorMessage.Should().BeNull();
        result.Summary.Should().NotBeNull();
        result.CanonicalActivity.Should().NotBeNull();

        var canonical = result.CanonicalActivity!;
        canonical.SourceFormat.Should().Be("TCX");
        canonical.TrackpointCount.Should().Be(2);
        canonical.HasGpsData.Should().BeTrue();
        canonical.HeartRateMinBpm.Should().Be(120);
        canonical.HeartRateAverageBpm.Should().Be(135);
        canonical.HeartRateMaxBpm.Should().Be(150);
        canonical.DistanceMeters.Should().BeGreaterThan(0);
        canonical.QualityStatus.Should().Be("High");
    }

    [Fact]
    public async Task R1_05_Ac01_TcxAdapter_ParseAsync_WhenRootIsInvalid_ShouldReturnFailure()
    {
        const string invalidRootXml = "<root><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></root>";

        var result = await _adapter.ParseAsync(System.Text.Encoding.UTF8.GetBytes(invalidRootXml), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Contain("Expected a TCX TrainingCenterDatabase document");
        result.Summary.Should().BeNull();
        result.CanonicalActivity.Should().BeNull();
    }
}
