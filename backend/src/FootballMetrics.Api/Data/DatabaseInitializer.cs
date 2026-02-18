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
                StoredFilePath TEXT NOT NULL DEFAULT '',
                RawFileContent BLOB NOT NULL,
                ContentHashSha256 TEXT NOT NULL,
                UploadStatus TEXT NOT NULL DEFAULT 'Succeeded',
                FailureReason TEXT NULL,
                UploadedAtUtc TEXT NOT NULL,
                SelectedSmoothingFilter TEXT NOT NULL DEFAULT 'AdaptiveMedian',
                SessionType TEXT NOT NULL DEFAULT 'Training',
                MatchResult TEXT NULL,
                Competition TEXT NULL,
                OpponentName TEXT NULL,
                OpponentLogoUrl TEXT NULL
            );

            CREATE INDEX IF NOT EXISTS IX_TcxUploads_UploadedAtUtc ON TcxUploads (UploadedAtUtc DESC);

            CREATE TABLE IF NOT EXISTS UserProfiles (
                Id INTEGER PRIMARY KEY,
                PrimaryPosition TEXT NOT NULL,
                SecondaryPosition TEXT NULL
            );
        ";

        await command.ExecuteNonQueryAsync(cancellationToken);

        await EnsureColumnExistsAsync(connection, "StoredFilePath", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await EnsureColumnExistsAsync(connection, "RawFileContent", "BLOB NOT NULL DEFAULT x''", cancellationToken);
        await EnsureColumnExistsAsync(connection, "ContentHashSha256", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await EnsureColumnExistsAsync(connection, "UploadStatus", "TEXT NOT NULL DEFAULT 'Succeeded'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "FailureReason", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SelectedSmoothingFilter", "TEXT NOT NULL DEFAULT 'AdaptiveMedian'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SessionType", "TEXT NOT NULL DEFAULT 'Training'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "MatchResult", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "Competition", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "OpponentName", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "OpponentLogoUrl", "TEXT NULL", cancellationToken);
    }

    private static async Task EnsureColumnExistsAsync(SqliteConnection connection, string columnName, string columnDefinition, CancellationToken cancellationToken)
    {
        var pragmaCommand = connection.CreateCommand();
        pragmaCommand.CommandText = "PRAGMA table_info(TcxUploads);";

        await using var reader = await pragmaCommand.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        var alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE TcxUploads ADD COLUMN {columnName} {columnDefinition};";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }
}
