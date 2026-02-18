using FootballMetrics.Api.Data;
using FootballMetrics.Api.Models;
using Microsoft.Data.Sqlite;

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
            INSERT INTO TcxUploads (Id, FileName, StoredFilePath, RawFileContent, ContentHashSha256, UploadStatus, FailureReason, UploadedAtUtc, SelectedSmoothingFilter, SelectedSmoothingFilterSource, SessionType, MatchResult, Competition, OpponentName, OpponentLogoUrl, MetricThresholdSnapshotJson, AppliedProfileSnapshotJson, RecalculationHistoryJson, SelectedSpeedUnit, SelectedSpeedUnitSource)
            VALUES ($id, $fileName, $storedFilePath, $rawFileContent, $contentHashSha256, $uploadStatus, $failureReason, $uploadedAtUtc, $selectedSmoothingFilter, $selectedSmoothingFilterSource, $sessionType, $matchResult, $competition, $opponentName, $opponentLogoUrl, $metricThresholdSnapshotJson, $appliedProfileSnapshotJson, $recalculationHistoryJson, $selectedSpeedUnit, $selectedSpeedUnitSource);
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
        command.Parameters.AddWithValue("$selectedSmoothingFilterSource", upload.SelectedSmoothingFilterSource);
        command.Parameters.AddWithValue("$sessionType", upload.SessionType);
        command.Parameters.AddWithValue("$matchResult", (object?)upload.MatchResult ?? DBNull.Value);
        command.Parameters.AddWithValue("$competition", (object?)upload.Competition ?? DBNull.Value);
        command.Parameters.AddWithValue("$opponentName", (object?)upload.OpponentName ?? DBNull.Value);
        command.Parameters.AddWithValue("$opponentLogoUrl", (object?)upload.OpponentLogoUrl ?? DBNull.Value);
        command.Parameters.AddWithValue("$metricThresholdSnapshotJson", (object?)upload.MetricThresholdSnapshotJson ?? DBNull.Value);
        command.Parameters.AddWithValue("$appliedProfileSnapshotJson", (object?)upload.AppliedProfileSnapshotJson ?? DBNull.Value);
        command.Parameters.AddWithValue("$recalculationHistoryJson", (object?)upload.RecalculationHistoryJson ?? DBNull.Value);
        command.Parameters.AddWithValue("$selectedSpeedUnit", upload.SelectedSpeedUnit);
        command.Parameters.AddWithValue("$selectedSpeedUnitSource", upload.SelectedSpeedUnitSource);

        await command.ExecuteNonQueryAsync(cancellationToken);
        return upload;
    }

    public async Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT Id, FileName, StoredFilePath, RawFileContent, ContentHashSha256, UploadStatus, FailureReason, UploadedAtUtc, SelectedSmoothingFilter, SelectedSmoothingFilterSource, SessionType, MatchResult, Competition, OpponentName, OpponentLogoUrl, MetricThresholdSnapshotJson, AppliedProfileSnapshotJson, RecalculationHistoryJson, SelectedSpeedUnit, SelectedSpeedUnitSource
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
            SELECT Id, FileName, StoredFilePath, RawFileContent, ContentHashSha256, UploadStatus, FailureReason, UploadedAtUtc, SelectedSmoothingFilter, SelectedSmoothingFilterSource, SessionType, MatchResult, Competition, OpponentName, OpponentLogoUrl, MetricThresholdSnapshotJson, AppliedProfileSnapshotJson, RecalculationHistoryJson, SelectedSpeedUnit, SelectedSpeedUnitSource
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
            SelectedSmoothingFilter = reader.IsDBNull(8) ? TcxSmoothingFilters.AdaptiveMedian : reader.GetString(8),
            SelectedSmoothingFilterSource = reader.IsDBNull(9) ? TcxSmoothingFilterSources.ProfileDefault : reader.GetString(9),
            SessionType = reader.IsDBNull(10) ? TcxSessionTypes.Training : reader.GetString(10),
            MatchResult = reader.IsDBNull(11) ? null : reader.GetString(11),
            Competition = reader.IsDBNull(12) ? null : reader.GetString(12),
            OpponentName = reader.IsDBNull(13) ? null : reader.GetString(13),
            OpponentLogoUrl = reader.IsDBNull(14) ? null : reader.GetString(14),
            MetricThresholdSnapshotJson = reader.IsDBNull(15) ? null : reader.GetString(15),
            AppliedProfileSnapshotJson = reader.IsDBNull(16) ? null : reader.GetString(16),
            RecalculationHistoryJson = reader.IsDBNull(17) ? null : reader.GetString(17),
            SelectedSpeedUnit = reader.IsDBNull(18) ? SpeedUnits.KilometersPerHour : reader.GetString(18),
            SelectedSpeedUnitSource = reader.IsDBNull(19) ? TcxSpeedUnitSources.ProfileDefault : reader.GetString(19)
        };

    public async Task<bool> UpdateSessionContextAsync(Guid id, string sessionType, string? matchResult, string? competition, string? opponentName, string? opponentLogoUrl, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            UPDATE TcxUploads
            SET SessionType = $sessionType,
                MatchResult = $matchResult,
                Competition = $competition,
                OpponentName = $opponentName,
                OpponentLogoUrl = $opponentLogoUrl
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$sessionType", sessionType);
        command.Parameters.AddWithValue("$matchResult", (object?)matchResult ?? DBNull.Value);
        command.Parameters.AddWithValue("$competition", (object?)competition ?? DBNull.Value);
        command.Parameters.AddWithValue("$opponentName", (object?)opponentName ?? DBNull.Value);
        command.Parameters.AddWithValue("$opponentLogoUrl", (object?)opponentLogoUrl ?? DBNull.Value);

        var affectedRows = await command.ExecuteNonQueryAsync(cancellationToken);
        return affectedRows > 0;
    }

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

    public async Task<bool> UpdateProfileSnapshotsAsync(Guid id, string metricThresholdSnapshotJson, string appliedProfileSnapshotJson, string recalculationHistoryJson, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            UPDATE TcxUploads
            SET MetricThresholdSnapshotJson = $metricThresholdSnapshotJson,
                AppliedProfileSnapshotJson = $appliedProfileSnapshotJson,
                RecalculationHistoryJson = $recalculationHistoryJson
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$metricThresholdSnapshotJson", metricThresholdSnapshotJson);
        command.Parameters.AddWithValue("$appliedProfileSnapshotJson", appliedProfileSnapshotJson);
        command.Parameters.AddWithValue("$recalculationHistoryJson", recalculationHistoryJson);

        var affectedRows = await command.ExecuteNonQueryAsync(cancellationToken);
        return affectedRows > 0;
    }

    public async Task<bool> UpdateSelectedSmoothingFilterSourceAsync(Guid id, string selectedSmoothingFilterSource, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            UPDATE TcxUploads
            SET SelectedSmoothingFilterSource = $selectedSmoothingFilterSource
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$selectedSmoothingFilterSource", selectedSmoothingFilterSource);

        var affectedRows = await command.ExecuteNonQueryAsync(cancellationToken);
        return affectedRows > 0;
    }

    public async Task<bool> UpdateSelectedSpeedUnitAsync(Guid id, string selectedSpeedUnit, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            UPDATE TcxUploads
            SET SelectedSpeedUnit = $selectedSpeedUnit
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$selectedSpeedUnit", selectedSpeedUnit);

        var affectedRows = await command.ExecuteNonQueryAsync(cancellationToken);
        return affectedRows > 0;
    }


    public async Task<bool> UpdateSessionPreferencesAndSnapshotsAsync(
        Guid id,
        string? selectedSmoothingFilter,
        string? selectedSmoothingFilterSource,
        string? selectedSpeedUnit,
        string? selectedSpeedUnitSource,
        string? metricThresholdSnapshotJson,
        string? appliedProfileSnapshotJson,
        string? recalculationHistoryJson,
        CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = @"
            UPDATE TcxUploads
            SET SelectedSmoothingFilter = COALESCE($selectedSmoothingFilter, SelectedSmoothingFilter),
                SelectedSmoothingFilterSource = COALESCE($selectedSmoothingFilterSource, SelectedSmoothingFilterSource),
                SelectedSpeedUnit = COALESCE($selectedSpeedUnit, SelectedSpeedUnit),
                SelectedSpeedUnitSource = COALESCE($selectedSpeedUnitSource, SelectedSpeedUnitSource),
                MetricThresholdSnapshotJson = COALESCE($metricThresholdSnapshotJson, MetricThresholdSnapshotJson),
                AppliedProfileSnapshotJson = COALESCE($appliedProfileSnapshotJson, AppliedProfileSnapshotJson),
                RecalculationHistoryJson = COALESCE($recalculationHistoryJson, RecalculationHistoryJson)
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$selectedSmoothingFilter", (object?)selectedSmoothingFilter ?? DBNull.Value);
        command.Parameters.AddWithValue("$selectedSmoothingFilterSource", (object?)selectedSmoothingFilterSource ?? DBNull.Value);
        command.Parameters.AddWithValue("$selectedSpeedUnit", (object?)selectedSpeedUnit ?? DBNull.Value);
        command.Parameters.AddWithValue("$selectedSpeedUnitSource", (object?)selectedSpeedUnitSource ?? DBNull.Value);
        command.Parameters.AddWithValue("$metricThresholdSnapshotJson", (object?)metricThresholdSnapshotJson ?? DBNull.Value);
        command.Parameters.AddWithValue("$appliedProfileSnapshotJson", (object?)appliedProfileSnapshotJson ?? DBNull.Value);
        command.Parameters.AddWithValue("$recalculationHistoryJson", (object?)recalculationHistoryJson ?? DBNull.Value);

        var affectedRows = await command.ExecuteNonQueryAsync(cancellationToken);
        if (affectedRows <= 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

        await transaction.CommitAsync(cancellationToken);
        return true;
    }
    public async Task<bool> UpdateSelectedSpeedUnitSourceAsync(Guid id, string selectedSpeedUnitSource, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            UPDATE TcxUploads
            SET SelectedSpeedUnitSource = $selectedSpeedUnitSource
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$selectedSpeedUnitSource", selectedSpeedUnitSource);

        var affectedRows = await command.ExecuteNonQueryAsync(cancellationToken);
        return affectedRows > 0;
    }
}
