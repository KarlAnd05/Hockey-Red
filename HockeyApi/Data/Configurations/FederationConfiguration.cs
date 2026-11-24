using HockeyApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HockeyApi.Data.Configurations;

public class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.HasIndex(t => t.Slug).IsUnique();
        builder.HasIndex(t => new { t.IsActive, t.SortOrder });
    }
}

public class PlayerConfiguration : IEntityTypeConfiguration<Player>
{
    public void Configure(EntityTypeBuilder<Player> builder)
    {
        builder.HasIndex(p => p.Slug).IsUnique();

        /* The team page's own query, in its own order. Leaving this out turns
           every team page into a sort of the whole player table. */
        builder.HasIndex(p => new { p.TeamId, p.Squad, p.Position, p.SortOrder });

        builder.HasOne(p => p.Team)
            .WithMany(t => t.Players)
            .HasForeignKey(p => p.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint(
            "CK_Players_PriorTotals",
            "\"PriorGames\" >= 0 AND \"PriorGoals\" >= 0 AND \"PriorAssists\" >= 0"));
    }
}

public class RosterPlayerConfiguration : IEntityTypeConfiguration<RosterPlayer>
{
    public void Configure(EntityTypeBuilder<RosterPlayer> builder)
    {
        builder.HasIndex(r => new { r.Program, r.Squad, r.Position, r.SortOrder });
    }
}

public class GameConfiguration : IEntityTypeConfiguration<Game>
{
    public void Configure(EntityTypeBuilder<Game> builder)
    {
        /* Newest first is how every fixture list is read, so the index is
           declared in that direction rather than being reversed at query
           time. */
        builder.HasIndex(g => g.PlayedAt).IsDescending();

        builder.HasOne(g => g.Team)
            .WithMany(t => t.Games)
            .HasForeignKey(g => g.TeamId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.ToTable(t => t.HasCheckConstraint(
            "CK_Games_Score",
            "(\"ScoreFor\" IS NULL OR \"ScoreFor\" >= 0) "
            + "AND (\"ScoreAgainst\" IS NULL OR \"ScoreAgainst\" >= 0)"));
    }
}

public class GameSheetPlayerConfiguration : IEntityTypeConfiguration<GameSheetPlayer>
{
    public void Configure(EntityTypeBuilder<GameSheetPlayer> builder)
    {
        builder.HasIndex(s => new { s.GameId, s.SortOrder });

        /* One line per player per game. Without this a double-submitted sheet
           counts somebody's goals twice, and nothing downstream would notice.

           PostgreSQL treats NULLs as distinct in a unique index, so lines for
           non-roster guests (PlayerId null) are unaffected - which is the
           behaviour wanted here. */
        builder.HasIndex(s => new { s.GameId, s.PlayerId }).IsUnique();

        builder.HasOne(s => s.Game)
            .WithMany(g => g.SheetPlayers)
            .HasForeignKey(s => s.GameId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Player)
            .WithMany(p => p.GameSheetLines)
            .HasForeignKey(s => s.PlayerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.Registration)
            .WithMany()
            .HasForeignKey(s => s.RegistrationId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.ToTable(t => t.HasCheckConstraint(
            "CK_GameSheetPlayers_Stats",
            "\"Goals\" >= 0 AND \"Assists\" >= 0 AND \"PenaltyMinutes\" >= 0 "
            + "AND \"ShotsAgainst\" >= 0 AND \"Saves\" >= 0 AND \"Saves\" <= \"ShotsAgainst\""));
    }
}

public class ProgramEventConfiguration : IEntityTypeConfiguration<ProgramEvent>
{
    public void Configure(EntityTypeBuilder<ProgramEvent> builder)
    {
        /* The class is ProgramEvent because ASP.NET Core already generates a
           Program class in this assembly. The table keeps the domain's name. */
        builder.ToTable("Programs");

        builder.HasIndex(p => new { p.IsActive, p.StartsAt });

        builder.HasOne(p => p.Team)
            .WithMany(t => t.Programs)
            .HasForeignKey(p => p.TeamId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.ToTable(t => t.HasCheckConstraint(
            "CK_Programs_Dates",
            "\"EndsAt\" IS NULL OR \"StartsAt\" IS NULL OR \"EndsAt\" >= \"StartsAt\""));
    }
}

public class SponsorConfiguration : IEntityTypeConfiguration<Sponsor>
{
    public void Configure(EntityTypeBuilder<Sponsor> builder)
    {
        builder.HasIndex(s => new { s.IsActive, s.Tier, s.SortOrder });
    }
}

public class NewsPostConfiguration : IEntityTypeConfiguration<NewsPost>
{
    public void Configure(EntityTypeBuilder<NewsPost> builder)
    {
        builder.HasIndex(n => n.Slug).IsUnique();
        builder.HasIndex(n => new { n.IsActive, n.PublishedAt });
    }
}
