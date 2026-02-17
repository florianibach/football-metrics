using FootballMetrics.Api.Data;
using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Repositories;

public class TcxUploadRepository : ITcxUploadRepository
{
    private readonly ISqliteConnectionFactory _connectionFactory;

    public TcxUploadRepository(ISqliteConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<TcxUpload> AddAsync(TcxUpload upload, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            INSERT INTO TcxUploads (Id, FileName, StoredFilePath, RawFileContent, ContentHashSha256, UploadStatus, FailureReason, UploadedAtUtc, SelectedSmoothingFilter)
            VALUES ($id, $fileName, $storedFilePath, $rawFileContent, $contentHashSha256, $uploadStatus, $failureReason, $uploadedAtUtc, $selectedSmoothingFilter);
        ";
        command.Parameters.AddWithValue("$id", upload.Id.ToString());
        command.Parameters.AddWithValue("$fileName", upload.FileName);
        command.Parameters.AddWithValue("$storedFilePath", upload.StoredFilePath);
        command.Parameters.AddWithValue("$rawFileContent", upload.RawFileContent);
        command.Parameters.AddWithValue("$contentHashSha256", upload.ContentHashSha256);
        command.Parameters.AddWithValue("$uploadStatus", upload.UploadStatus);
        command.Parameters.AddWithValue("$failureReason", (object?)upload.FailureReason ?? DBNull.Value);
        command.Parameters.AddWithValue("$uploadedAtUtc", upload.UploadedAtUtc.ToString("O"));
        command.Parameters.AddWithValue("$selectedSmoothingFilter", upload.SelectedSmoothingFilter);

        await command.ExecuteNonQueryAsync(cancellationToken);
        return upload;
    }

    public async Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT Id, FileName, StoredFilePath, RawFileContent, ContentHashSha256, UploadStatus, FailureReason, UploadedAtUtc, SelectedSmoothingFilter
            FROM TcxUploads
            ORDER BY UploadedAtUtc DESC;
        ";

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var uploads = new List<TcxUpload>();

        while (await reader.ReadAsync(cancellationToken))
        {
            uploads.Add(MapUpload(reader));
        }

        return uploads;
    }

    public async Task<TcxUpload?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT Id, FileName, StoredFilePath, RawFileContent, ContentHashSha256, UploadStatus, FailureReason, UploadedAtUtc, SelectedSmoothingFilter
            FROM TcxUploads
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", id.ToString());

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapUpload(reader);
    }

    private static TcxUpload MapUpload(Microsoft.Data.Sqlite.SqliteDataReader reader)
        => new()
        {
            Id = Guid.Parse(reader.GetString(0)),
            FileName = reader.GetString(1),
            StoredFilePath = reader.GetString(2),
            RawFileContent = (byte[])reader[3],
            ContentHashSha256 = reader.GetString(4),
            UploadStatus = reader.GetString(5),
            FailureReason = reader.IsDBNull(6) ? null : reader.GetString(6),
            UploadedAtUtc = DateTime.Parse(reader.GetString(7), null, System.Globalization.DateTimeStyles.RoundtripKind),
            SelectedSmoothingFilter = reader.IsDBNull(8) ? TcxSmoothingFilters.AdaptiveMedian : reader.GetString(8)
        };

    public async Task<bool> UpdateSelectedSmoothingFilterAsync(Guid id, string selectedSmoothingFilter, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            UPDATE TcxUploads
            SET SelectedSmoothingFilter = $selectedSmoothingFilter
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$selectedSmoothingFilter", selectedSmoothingFilter);

        var affectedRows = await command.ExecuteNonQueryAsync(cancellationToken);
        return affectedRows > 0;
    }
}
