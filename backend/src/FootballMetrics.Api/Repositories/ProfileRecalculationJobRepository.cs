using FootballMetrics.Api.Data;
using FootballMetrics.Api.Models;
using Microsoft.Data.Sqlite;

namespace FootballMetrics.Api.Repositories;

public class ProfileRecalculationJobRepository : IProfileRecalculationJobRepository
{
    private readonly ISqliteConnectionFactory _connectionFactory;

    public ProfileRecalculationJobRepository(ISqliteConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<ProfileRecalculationJob> AddAsync(ProfileRecalculationJob job, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = @"
            INSERT INTO ProfileRecalculationJobs (Id, Status, TriggerSource, RequestedAtUtc, CompletedAtUtc, ProfileThresholdVersion, TotalSessions, UpdatedSessions, FailedSessions, ErrorMessage)
            VALUES ($id, $status, $trigger, $requestedAtUtc, $completedAtUtc, $profileThresholdVersion, $totalSessions, $updatedSessions, $failedSessions, $errorMessage);
        ";

        command.Parameters.AddWithValue("$id", job.Id.ToString());
        command.Parameters.AddWithValue("$status", job.Status);
        command.Parameters.AddWithValue("$trigger", job.Trigger);
        command.Parameters.AddWithValue("$requestedAtUtc", job.RequestedAtUtc.ToString("O"));
        command.Parameters.AddWithValue("$completedAtUtc", (object?)job.CompletedAtUtc?.ToString("O") ?? DBNull.Value);
        command.Parameters.AddWithValue("$profileThresholdVersion", job.ProfileThresholdVersion);
        command.Parameters.AddWithValue("$totalSessions", job.TotalSessions);
        command.Parameters.AddWithValue("$updatedSessions", job.UpdatedSessions);
        command.Parameters.AddWithValue("$failedSessions", job.FailedSessions);
        command.Parameters.AddWithValue("$errorMessage", (object?)job.ErrorMessage ?? DBNull.Value);

        await command.ExecuteNonQueryAsync(cancellationToken);
        return job;
    }

    public async Task<ProfileRecalculationJob?> GetLatestAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT Id, Status, TriggerSource, RequestedAtUtc, CompletedAtUtc, ProfileThresholdVersion, TotalSessions, UpdatedSessions, FailedSessions, ErrorMessage
            FROM ProfileRecalculationJobs
            ORDER BY RequestedAtUtc DESC
            LIMIT 1;
        ";

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return Map(reader);
    }

    public async Task<bool> UpdateOutcomeAsync(Guid id, string status, int totalSessions, int updatedSessions, int failedSessions, string? errorMessage, DateTime completedAtUtc, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = @"
            UPDATE ProfileRecalculationJobs
            SET Status = $status,
                TotalSessions = $totalSessions,
                UpdatedSessions = $updatedSessions,
                FailedSessions = $failedSessions,
                ErrorMessage = $errorMessage,
                CompletedAtUtc = $completedAtUtc
            WHERE Id = $id;
        ";

        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$status", status);
        command.Parameters.AddWithValue("$totalSessions", totalSessions);
        command.Parameters.AddWithValue("$updatedSessions", updatedSessions);
        command.Parameters.AddWithValue("$failedSessions", failedSessions);
        command.Parameters.AddWithValue("$errorMessage", (object?)errorMessage ?? DBNull.Value);
        command.Parameters.AddWithValue("$completedAtUtc", completedAtUtc.ToString("O"));

        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    private static ProfileRecalculationJob Map(SqliteDataReader reader)
    {
        return new ProfileRecalculationJob
        {
            Id = Guid.Parse(reader.GetString(0)),
            Status = reader.GetString(1),
            Trigger = reader.GetString(2),
            RequestedAtUtc = DateTime.Parse(reader.GetString(3), null, System.Globalization.DateTimeStyles.RoundtripKind),
            CompletedAtUtc = reader.IsDBNull(4) ? null : DateTime.Parse(reader.GetString(4), null, System.Globalization.DateTimeStyles.RoundtripKind),
            ProfileThresholdVersion = reader.GetInt32(5),
            TotalSessions = reader.GetInt32(6),
            UpdatedSessions = reader.GetInt32(7),
            FailedSessions = reader.GetInt32(8),
            ErrorMessage = reader.IsDBNull(9) ? null : reader.GetString(9)
        };
    }
}
