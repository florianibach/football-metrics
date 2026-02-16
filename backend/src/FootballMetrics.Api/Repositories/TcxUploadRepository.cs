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
            INSERT INTO TcxUploads (Id, FileName, StoredFilePath, UploadedAtUtc)
            VALUES ($id, $fileName, $storedFilePath, $uploadedAtUtc);
        ";
        command.Parameters.AddWithValue("$id", upload.Id.ToString());
        command.Parameters.AddWithValue("$fileName", upload.FileName);
        command.Parameters.AddWithValue("$storedFilePath", upload.StoredFilePath);
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
            SELECT Id, FileName, StoredFilePath, UploadedAtUtc
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
                StoredFilePath = reader.GetString(2),
                UploadedAtUtc = DateTime.Parse(reader.GetString(3), null, System.Globalization.DateTimeStyles.RoundtripKind)
            });
        }

        return uploads;
    }
}
