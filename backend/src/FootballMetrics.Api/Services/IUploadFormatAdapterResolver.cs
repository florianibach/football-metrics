namespace FootballMetrics.Api.Services;

public interface IUploadFormatAdapterResolver
{
    IUploadFormatAdapter? ResolveByFileName(string fileName);

    IReadOnlyCollection<string> GetSupportedExtensions();
}
