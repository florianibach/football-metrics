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
            INSERT INTO TcxUploads (Id, FileName, RawFileContent, ContentHashSha256, UploadStatus, FailureReason, UploadedAtUtc)
            VALUES ($id, $fileName, $rawFileContent, $contentHashSha256, $uploadStatus, $failureReason, $uploadedAtUtc);
        ";
        command.Parameters.AddWithValue("$id", upload.Id.ToString());
        command.Parameters.AddWithValue("$fileName", upload.FileName);
        command.Parameters.AddWithValue("$rawFileContent", upload.RawFileContent);
        command.Parameters.AddWithValue("$contentHashSha256", upload.ContentHashSha256);
        command.Parameters.AddWithValue("$uploadStatus", upload.UploadStatus);
        command.Parameters.AddWithValue("$failureReason", (object?)upload.FailureReason ?? DBNull.Value);
        command.Parameters.AddWithValue("$uploadedAtUtc", upload.UploadedAtUtc.ToString("O"));

        await command.ExecuteNonQueryAsync(cancellationToken);
        return upload;
    }

    public async Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT Id, FileName, RawFileContent, ContentHashSha256, UploadStatus, FailureReason, UploadedAtUtc
            FROM TcxUploads
            ORDER BY UploadedAtUtc DESC;
        ";

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var uploads = new List<TcxUpload>();

        while (await reader.ReadAsync(cancellationToken))
        {
            uploads.Add(new TcxUpload
            {
                Id = Guid.Parse(reader.GetString(0)),
                FileName = reader.GetString(1),
                RawFileContent = (byte[])reader[2],
                ContentHashSha256 = reader.GetString(3),
                UploadStatus = reader.GetString(4),
                FailureReason = reader.IsDBNull(5) ? null : reader.GetString(5),
                UploadedAtUtc = DateTime.Parse(reader.GetString(6), null, System.Globalization.DateTimeStyles.RoundtripKind)
            });
        }

        return uploads;
    }
}
