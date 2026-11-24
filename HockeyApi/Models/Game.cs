using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>A fixture, and the spine of a game sheet.</summary>
public class Game
{
    public int Id { get; set; }

    /// <summary>Nullable: deleting a team must not delete its match history.</summary>
    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    [MaxLength(160)]
    public string Opponent { get; set; } = string.Empty;

    public DateTime? PlayedAt { get; set; }

    [MaxLength(200)]
    public string Venue { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Competition { get; set; } = string.Empty;

    public HomeAway HomeAway { get; set; } = HomeAway.Home;

    /// <summary>Null until the game has been played and the sheet finalised.</summary>
    public int? ScoreFor { get; set; }
    public int? ScoreAgainst { get; set; }

    /// <summary>Draft keeps a sheet off the public site while it is being
    /// filled in; only Final counts towards published statistics.</summary>
    public GameStatus Status { get; set; } = GameStatus.Draft;

    [MaxLength(2000)]
    public string Notes { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<GameSheetPlayer> SheetPlayers { get; set; } = new List<GameSheetPlayer>();
}
