using FootballMetrics.Api.Services;
using FluentAssertions;
using Xunit;

namespace FootballMetrics.Api.Tests;

public class UploadFormatAdapterResolverTests
{
    [Fact]
    public void R1_05_Ac01_Resolver_ShouldReturnAdapterByExtensionCaseInsensitive()
    {
        var resolver = new UploadFormatAdapterResolver(new IUploadFormatAdapter[] { new TcxUploadFormatAdapter() });

        var adapter = resolver.ResolveByFileName("session.TCX");

        adapter.Should().NotBeNull();
        adapter!.FormatKey.Should().Be("TCX");
    }

    [Fact]
    public void R1_05_Ac01_Resolver_ShouldReturnNullForUnsupportedExtension()
    {
        var resolver = new UploadFormatAdapterResolver(new IUploadFormatAdapter[] { new TcxUploadFormatAdapter() });

        var adapter = resolver.ResolveByFileName("session.fit");

        adapter.Should().BeNull();
        resolver.GetSupportedExtensions().Should().ContainSingle().Which.Should().Be(".tcx");
    }
}
