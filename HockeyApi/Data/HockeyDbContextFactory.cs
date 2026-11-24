using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace HockeyApi.Data;

/// <summary>
/// How the `dotnet ef` command line builds a DbContext.
///
/// Without this, the tools start the whole application to find one - and
/// Program.cs deliberately refuses to start without a signing key, so
/// `dotnet ef migrations add` would fail on a machine that has not set one yet.
/// That fail-fast behaviour is worth keeping, so the tooling gets its own
/// narrow path instead of the application being loosened.
///
/// Generating a migration does not open a connection, so the fallback string
/// below only has to parse. `dotnet ef database update` does connect, and for
/// that the real one has to be configured.
/// </summary>
public class HockeyDbContextFactory : IDesignTimeDbContextFactory<HockeyDbContext>
{
    public HockeyDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddUserSecrets<HockeyDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(connectionString)
            || connectionString.Contains("__SET_IN_USER_SECRETS__", StringComparison.Ordinal))
        {
            // Enough to build the model. Not enough to connect, on purpose.
            connectionString = "Host=localhost;Port=5432;Database=hockeydb;Username=postgres";
        }

        var options = new DbContextOptionsBuilder<HockeyDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new HockeyDbContext(options);
    }
}
