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
            SELECT PrimaryPosition, SecondaryPosition
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
            SecondaryPosition = reader.IsDBNull(1) ? null : reader.GetString(1)
        };
    }

    public async Task<UserProfile> UpsertAsync(UserProfile profile, CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var command = connection.CreateCommand();
        command.CommandText = @"
            INSERT INTO UserProfiles (Id, PrimaryPosition, SecondaryPosition)
            VALUES ($id, $primaryPosition, $secondaryPosition)
            ON CONFLICT(Id) DO UPDATE SET
                PrimaryPosition = excluded.PrimaryPosition,
                SecondaryPosition = excluded.SecondaryPosition;
        ";
        command.Parameters.AddWithValue("$id", SingletonProfileId);
        command.Parameters.AddWithValue("$primaryPosition", profile.PrimaryPosition);
        command.Parameters.AddWithValue("$secondaryPosition", (object?)profile.SecondaryPosition ?? DBNull.Value);

        await command.ExecuteNonQueryAsync(cancellationToken);
        return profile;
    }
}
