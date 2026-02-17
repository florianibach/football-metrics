namespace FootballMetrics.Api.Services;

public sealed class UploadFormatAdapterResolver : IUploadFormatAdapterResolver
{
    private readonly IReadOnlyDictionary<string, IUploadFormatAdapter> _adaptersByExtension;

    public UploadFormatAdapterResolver(IEnumerable<IUploadFormatAdapter> adapters)
    {
        _adaptersByExtension = adapters
            .SelectMany(adapter => adapter.SupportedExtensions.Select(extension => new { Extension = NormalizeExtension(extension), Adapter = adapter }))
            .DistinctBy(entry => entry.Extension)
            .ToDictionary(entry => entry.Extension, entry => entry.Adapter, StringComparer.OrdinalIgnoreCase);
    }

    public IUploadFormatAdapter? ResolveByFileName(string fileName)
    {
        var extension = NormalizeExtension(Path.GetExtension(fileName));
        if (string.IsNullOrWhiteSpace(extension))
        {
            return null;
        }

        return _adaptersByExtension.TryGetValue(extension, out var adapter) ? adapter : null;
    }

    public IReadOnlyCollection<string> GetSupportedExtensions() => _adaptersByExtension.Keys.OrderBy(key => key).ToArray();

    private static string NormalizeExtension(string extension) => extension.Trim().ToLowerInvariant();
}
