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
                SelectedSmoothingFilterSource TEXT NOT NULL DEFAULT 'ProfileDefault',
                SessionType TEXT NOT NULL DEFAULT 'Training',
                MatchResult TEXT NULL,
                Competition TEXT NULL,
                OpponentName TEXT NULL,
                OpponentLogoUrl TEXT NULL,
                MetricThresholdSnapshotJson TEXT NULL,
                AppliedProfileSnapshotJson TEXT NULL,
                RecalculationHistoryJson TEXT NULL,
                SelectedSpeedUnit TEXT NOT NULL DEFAULT 'km/h',
                SelectedSpeedUnitSource TEXT NOT NULL DEFAULT 'ProfileDefault',
                SessionSummarySnapshotJson TEXT NULL,
                IdempotencyKey TEXT NULL,
                SegmentsSnapshotJson TEXT NULL,
                SegmentChangeHistoryJson TEXT NULL
            );

            CREATE INDEX IF NOT EXISTS IX_TcxUploads_UploadedAtUtc ON TcxUploads (UploadedAtUtc DESC);

            CREATE TABLE IF NOT EXISTS UserProfiles (
                Id INTEGER PRIMARY KEY,
                PrimaryPosition TEXT NOT NULL,
                SecondaryPosition TEXT NULL,
                MetricThresholdsJson TEXT NULL,
                DefaultSmoothingFilter TEXT NOT NULL DEFAULT 'AdaptiveMedian',
                PreferredSpeedUnit TEXT NOT NULL DEFAULT 'km/h',
                PreferredAggregationWindowMinutes INTEGER NOT NULL DEFAULT 5
            );


            CREATE TABLE IF NOT EXISTS ProfileRecalculationJobs (
                Id TEXT PRIMARY KEY,
                Status TEXT NOT NULL,
                TriggerSource TEXT NOT NULL,
                RequestedAtUtc TEXT NOT NULL,
                CompletedAtUtc TEXT NULL,
                ProfileThresholdVersion INTEGER NOT NULL,
                TotalSessions INTEGER NOT NULL DEFAULT 0,
                UpdatedSessions INTEGER NOT NULL DEFAULT 0,
                FailedSessions INTEGER NOT NULL DEFAULT 0,
                ErrorMessage TEXT NULL
            );

            CREATE INDEX IF NOT EXISTS IX_ProfileRecalculationJobs_RequestedAtUtc ON ProfileRecalculationJobs (RequestedAtUtc DESC);

            CREATE TABLE IF NOT EXISTS SchemaVersions (
                Version INTEGER PRIMARY KEY,
                Description TEXT NOT NULL,
                AppliedAtUtc TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS TcxAdaptiveStats (
                UploadId TEXT PRIMARY KEY,
                MaxSpeedMps REAL NULL,
                MaxHeartRateBpm INTEGER NULL,
                CalculatedAtUtc TEXT NOT NULL,
                FOREIGN KEY (UploadId) REFERENCES TcxUploads(Id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS IX_TcxAdaptiveStats_CalculatedAtUtc ON TcxAdaptiveStats (CalculatedAtUtc DESC);
        ";

        await command.ExecuteNonQueryAsync(cancellationToken);

        await EnsureColumnExistsAsync(connection, "StoredFilePath", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await EnsureColumnExistsAsync(connection, "RawFileContent", "BLOB NOT NULL DEFAULT x''", cancellationToken);
        await EnsureColumnExistsAsync(connection, "ContentHashSha256", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await EnsureColumnExistsAsync(connection, "UploadStatus", "TEXT NOT NULL DEFAULT 'Succeeded'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "FailureReason", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SelectedSmoothingFilter", "TEXT NOT NULL DEFAULT 'AdaptiveMedian'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SelectedSmoothingFilterSource", "TEXT NOT NULL DEFAULT 'ProfileDefault'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SessionType", "TEXT NOT NULL DEFAULT 'Training'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "MatchResult", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "Competition", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "OpponentName", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "OpponentLogoUrl", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "MetricThresholdSnapshotJson", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "AppliedProfileSnapshotJson", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "RecalculationHistoryJson", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SelectedSpeedUnit", "TEXT NOT NULL DEFAULT 'km/h'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SelectedSpeedUnitSource", "TEXT NOT NULL DEFAULT 'ProfileDefault'", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SessionSummarySnapshotJson", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "IdempotencyKey", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SegmentsSnapshotJson", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SegmentChangeHistoryJson", "TEXT NULL", cancellationToken);
        await EnsureUserProfileColumnExistsAsync(connection, "MetricThresholdsJson", "TEXT NULL", cancellationToken);
        await EnsureUserProfileColumnExistsAsync(connection, "DefaultSmoothingFilter", "TEXT NOT NULL DEFAULT 'AdaptiveMedian'", cancellationToken);
        await EnsureUserProfileColumnExistsAsync(connection, "PreferredSpeedUnit", "TEXT NOT NULL DEFAULT 'km/h'", cancellationToken);
        await EnsureUserProfileColumnExistsAsync(connection, "PreferredAggregationWindowMinutes", "INTEGER NOT NULL DEFAULT 5", cancellationToken);

        await ApplyMigrationSlot001Async(connection, cancellationToken);
        await ApplyMigrationSlot002Async(connection, cancellationToken);
        await ApplyMigrationSlot003Async(connection, cancellationToken);
        await ApplyMigrationSlot004Async(connection, cancellationToken);
        await ApplyMigrationSlot005Async(connection, cancellationToken);
        await ApplyMigrationSlot006Async(connection, cancellationToken);
    }


    private static async Task ApplyMigrationSlot001Async(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var existsCommand = connection.CreateCommand();
        existsCommand.CommandText = "SELECT COUNT(1) FROM SchemaVersions WHERE Version = 1;";
        var alreadyApplied = Convert.ToInt32(await existsCommand.ExecuteScalarAsync(cancellationToken)) > 0;
        if (alreadyApplied)
        {
            return;
        }

        var insertCommand = connection.CreateCommand();
        insertCommand.CommandText = @"
            INSERT INTO SchemaVersions (Version, Description, AppliedAtUtc)
            VALUES (1, 'phase0_migration_slot_initialized', $appliedAtUtc);
        ";
        insertCommand.Parameters.AddWithValue("$appliedAtUtc", DateTime.UtcNow.ToString("O"));
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);
    }


    private static async Task ApplyMigrationSlot002Async(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var existsCommand = connection.CreateCommand();
        existsCommand.CommandText = "SELECT COUNT(1) FROM SchemaVersions WHERE Version = 2;";
        var alreadyApplied = Convert.ToInt32(await existsCommand.ExecuteScalarAsync(cancellationToken)) > 0;
        if (alreadyApplied)
        {
            return;
        }

        var createAdaptiveStatsTableCommand = connection.CreateCommand();
        createAdaptiveStatsTableCommand.CommandText = @"
            CREATE TABLE IF NOT EXISTS TcxAdaptiveStats (
                UploadId TEXT PRIMARY KEY,
                MaxSpeedMps REAL NULL,
                MaxHeartRateBpm INTEGER NULL,
                CalculatedAtUtc TEXT NOT NULL,
                FOREIGN KEY (UploadId) REFERENCES TcxUploads(Id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS IX_TcxAdaptiveStats_CalculatedAtUtc ON TcxAdaptiveStats (CalculatedAtUtc DESC);
        ";
        await createAdaptiveStatsTableCommand.ExecuteNonQueryAsync(cancellationToken);

        var insertCommand = connection.CreateCommand();
        insertCommand.CommandText = @"
            INSERT INTO SchemaVersions (Version, Description, AppliedAtUtc)
            VALUES (2, 'phase2_adaptive_stats_table', $appliedAtUtc);
        ";
        insertCommand.Parameters.AddWithValue("$appliedAtUtc", DateTime.UtcNow.ToString("O"));
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);
    }



    private static async Task ApplyMigrationSlot003Async(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var existsCommand = connection.CreateCommand();
        existsCommand.CommandText = "SELECT COUNT(1) FROM SchemaVersions WHERE Version = 3;";
        var alreadyApplied = Convert.ToInt32(await existsCommand.ExecuteScalarAsync(cancellationToken)) > 0;
        if (alreadyApplied)
        {
            return;
        }

        await EnsureColumnExistsAsync(connection, "SessionSummarySnapshotJson", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "IdempotencyKey", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SegmentsSnapshotJson", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SegmentChangeHistoryJson", "TEXT NULL", cancellationToken);

        var insertCommand = connection.CreateCommand();
        insertCommand.CommandText = @"
            INSERT INTO SchemaVersions (Version, Description, AppliedAtUtc)
            VALUES (3, 'phase3_session_summary_snapshot', $appliedAtUtc);
        ";
        insertCommand.Parameters.AddWithValue("$appliedAtUtc", DateTime.UtcNow.ToString("O"));
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);
    }



    private static async Task ApplyMigrationSlot004Async(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var existsCommand = connection.CreateCommand();
        existsCommand.CommandText = "SELECT COUNT(1) FROM SchemaVersions WHERE Version = 4;";
        var alreadyApplied = Convert.ToInt32(await existsCommand.ExecuteScalarAsync(cancellationToken)) > 0;
        if (alreadyApplied)
        {
            return;
        }

        await EnsureColumnExistsAsync(connection, "IdempotencyKey", "TEXT NULL", cancellationToken);

        var indexCommand = connection.CreateCommand();
        indexCommand.CommandText = "CREATE UNIQUE INDEX IF NOT EXISTS IX_TcxUploads_IdempotencyKey_Unique ON TcxUploads (IdempotencyKey) WHERE IdempotencyKey IS NOT NULL;";
        await indexCommand.ExecuteNonQueryAsync(cancellationToken);

        var insertCommand = connection.CreateCommand();
        insertCommand.CommandText = @"
            INSERT INTO SchemaVersions (Version, Description, AppliedAtUtc)
            VALUES (4, 'phase3_upload_idempotency_key', $appliedAtUtc);
        ";
        insertCommand.Parameters.AddWithValue("$appliedAtUtc", DateTime.UtcNow.ToString("O"));
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);
    }


    private static async Task ApplyMigrationSlot005Async(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var existsCommand = connection.CreateCommand();
        existsCommand.CommandText = "SELECT COUNT(1) FROM SchemaVersions WHERE Version = 5;";
        var alreadyApplied = Convert.ToInt32(await existsCommand.ExecuteScalarAsync(cancellationToken)) > 0;
        if (alreadyApplied)
        {
            return;
        }

        var tableCommand = connection.CreateCommand();
        tableCommand.CommandText = @"
            CREATE TABLE IF NOT EXISTS ProfileRecalculationJobs (
                Id TEXT PRIMARY KEY,
                Status TEXT NOT NULL,
                TriggerSource TEXT NOT NULL,
                RequestedAtUtc TEXT NOT NULL,
                CompletedAtUtc TEXT NULL,
                ProfileThresholdVersion INTEGER NOT NULL,
                TotalSessions INTEGER NOT NULL DEFAULT 0,
                UpdatedSessions INTEGER NOT NULL DEFAULT 0,
                FailedSessions INTEGER NOT NULL DEFAULT 0,
                ErrorMessage TEXT NULL
            );

            CREATE INDEX IF NOT EXISTS IX_ProfileRecalculationJobs_RequestedAtUtc ON ProfileRecalculationJobs (RequestedAtUtc DESC);
        ";
        await tableCommand.ExecuteNonQueryAsync(cancellationToken);

        var insertCommand = connection.CreateCommand();
        insertCommand.CommandText = @"
            INSERT INTO SchemaVersions (Version, Description, AppliedAtUtc)
            VALUES (5, 'r1_5_16_profile_recalculation_jobs', $appliedAtUtc);
        ";
        insertCommand.Parameters.AddWithValue("$appliedAtUtc", DateTime.UtcNow.ToString("O"));
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);
    }


    private static async Task ApplyMigrationSlot006Async(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var existsCommand = connection.CreateCommand();
        existsCommand.CommandText = "SELECT COUNT(1) FROM SchemaVersions WHERE Version = 6;";
        var alreadyApplied = Convert.ToInt32(await existsCommand.ExecuteScalarAsync(cancellationToken)) > 0;
        if (alreadyApplied)
        {
            return;
        }

        await EnsureColumnExistsAsync(connection, "SegmentsSnapshotJson", "TEXT NULL", cancellationToken);
        await EnsureColumnExistsAsync(connection, "SegmentChangeHistoryJson", "TEXT NULL", cancellationToken);

        var insertCommand = connection.CreateCommand();
        insertCommand.CommandText = @"
            INSERT INTO SchemaVersions (Version, Description, AppliedAtUtc)
            VALUES (6, 'r1_6_03_session_segments_versioning', $appliedAtUtc);
        ";
        insertCommand.Parameters.AddWithValue("$appliedAtUtc", DateTime.UtcNow.ToString("O"));
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);
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

    private static async Task EnsureUserProfileColumnExistsAsync(SqliteConnection connection, string columnName, string columnDefinition, CancellationToken cancellationToken)
    {
        var pragmaCommand = connection.CreateCommand();
        pragmaCommand.CommandText = "PRAGMA table_info(UserProfiles);";

        await using var reader = await pragmaCommand.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        var alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE UserProfiles ADD COLUMN {columnName} {columnDefinition};";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }
}
