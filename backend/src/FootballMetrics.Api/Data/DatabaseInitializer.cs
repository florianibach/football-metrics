using Microsoft.Data.Sqlite;

namespace FootballMetrics.Api.Data;

public interface IDatabaseInitializer
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
}

public sealed class DatabaseInitializer : IDatabaseInitializer
{
    private readonly ISqliteConnectionFactory _connectionFactory;

    public DatabaseInitializer(ISqliteConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            CREATE TABLE IF NOT EXISTS TcxUploads (
                Id TEXT PRIMARY KEY,
                FileName TEXT NOT NULL,
                StoredFilePath TEXT NOT NULL,
                UploadedAtUtc TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS IX_TcxUploads_UploadedAtUtc ON TcxUploads (UploadedAtUtc DESC);
        ";

        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
