using Microsoft.Data.Sqlite;
using System.IO;

namespace FootballMetrics.Api.Data;

public interface ISqliteConnectionFactory
{
    SqliteConnection CreateConnection();
}

public sealed class SqliteConnectionFactory : ISqliteConnectionFactory
{
    private readonly string _connectionString;
    private readonly string? _databaseDirectory;

    public SqliteConnectionFactory(string connectionString)
    {
        _connectionString = connectionString;

        var builder = new SqliteConnectionStringBuilder(connectionString);
        var dataSource = builder.DataSource;

        if (!string.IsNullOrWhiteSpace(dataSource) &&
            !string.Equals(dataSource, ":memory:", StringComparison.OrdinalIgnoreCase))
        {
            _databaseDirectory = Path.GetDirectoryName(dataSource);
        }
    }

    public SqliteConnection CreateConnection()
    {
        if (!string.IsNullOrWhiteSpace(_databaseDirectory))
        {
            Directory.CreateDirectory(_databaseDirectory);
        }

        return new SqliteConnection(_connectionString);
    }
}
