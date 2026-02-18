using System.Text.Json;
using FootballMetrics.Api.Data;
using FootballMetrics.Api.Models;

namespace FootballMetrics.Api.Repositories;

public class UserProfileRepository : IUserProfileRepository
{
    private const int SingletonProfileId = 1;
    private readonly ISqliteConnectionFactory _connectionFactory;

    public UserProfileRepository(ISqliteConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<UserProfile> GetAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT PrimaryPosition, SecondaryPosition, MetricThresholdsJson, DefaultSmoothingFilter
            FROM UserProfiles
            WHERE Id = $id;
        ";
        command.Parameters.AddWithValue("$id", SingletonProfileId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new UserProfile();
        }

        return new UserProfile
        {
            PrimaryPosition = reader.GetString(0),
            SecondaryPosition = reader.IsDBNull(1) ? null : reader.GetString(1),
            MetricThresholds = DeserializeThresholds(reader.IsDBNull(2) ? null : reader.GetString(2)),
            DefaultSmoothingFilter = DeserializeDefaultSmoothingFilter(reader.IsDBNull(3) ? null : reader.GetString(3))
        };
    }

    public async Task<UserProfile> UpsertAsync(UserProfile profile, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            INSERT INTO UserProfiles (Id, PrimaryPosition, SecondaryPosition, MetricThresholdsJson, DefaultSmoothingFilter)
            VALUES ($id, $primaryPosition, $secondaryPosition, $metricThresholdsJson, $defaultSmoothingFilter)
            ON CONFLICT(Id) DO UPDATE SET
                PrimaryPosition = excluded.PrimaryPosition,
                SecondaryPosition = excluded.SecondaryPosition,
                MetricThresholdsJson = excluded.MetricThresholdsJson,
                DefaultSmoothingFilter = excluded.DefaultSmoothingFilter;
        ";
        command.Parameters.AddWithValue("$id", SingletonProfileId);
        command.Parameters.AddWithValue("$primaryPosition", profile.PrimaryPosition);
        command.Parameters.AddWithValue("$secondaryPosition", (object?)profile.SecondaryPosition ?? DBNull.Value);
        command.Parameters.AddWithValue("$metricThresholdsJson", JsonSerializer.Serialize(profile.MetricThresholds));
        command.Parameters.AddWithValue("$defaultSmoothingFilter", profile.DefaultSmoothingFilter);

        await command.ExecuteNonQueryAsync(cancellationToken);
        return profile;
    }

    private static MetricThresholdProfile DeserializeThresholds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return MetricThresholdProfile.CreateDefault();
        }

        try
        {
            return JsonSerializer.Deserialize<MetricThresholdProfile>(json) ?? MetricThresholdProfile.CreateDefault();
        }
        catch
        {
            return MetricThresholdProfile.CreateDefault();
        }
    }

    private static string DeserializeDefaultSmoothingFilter(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return TcxSmoothingFilters.AdaptiveMedian;
        }

        return TcxSmoothingFilters.Supported.FirstOrDefault(filter => string.Equals(filter, value, StringComparison.OrdinalIgnoreCase))
            ?? TcxSmoothingFilters.AdaptiveMedian;
    }
}
