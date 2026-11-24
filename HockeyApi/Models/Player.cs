using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A squad member with their own page.
///
/// No date of birth, no contact details and no citizenship here. That
/// paperwork belongs to <see cref="Registration"/>, which is admin-only. This
/// class is the public profile, and it holds only what the federation intends
/// to publish - so a careless join cannot leak a minor's personal data onto a
/// team page.
/// </summary>
public class Player
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    [Required]
    [MaxLength(120)]
    public string Slug { get; set; } = null!;

    [Required]
    [MaxLength(160)]
    public string Name { get; set; } = null!;

    /// <summary>National team or the next-generation squad within the programme.</summary>
    public SquadLevel? Squad { get; set; }

    public PlayerPosition Position { get; set; } = PlayerPosition.Forward;

    /// <summary>Nullable on purpose - the federation's roster shows a dash for
    /// players without one.</summary>
    public int? JerseyNumber { get; set; }

    [MaxLength(500)]
    public string PhotoUrl { get; set; } = string.Empty;

    [MaxLength(300)]
    public string PhotoAlt { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Bio { get; set; } = string.Empty;

    [MaxLength(160)]
    public string RecentTeam { get; set; } = string.Empty;

    [MaxLength(160)]
    public string Resides { get; set; } = string.Empty;

    [MaxLength(160)]
    public string Hometown { get; set; } = string.Empty;

    /* Career totals from before the site started recording game sheets. Kept
       apart from the game-sheet figures so the two can never be confused: these
       are typed in by hand, those are derived. A player's published total is
       the sum of the two. */
    public int PriorGames { get; set; }
    public int PriorGoals { get; set; }
    public int PriorAssists { get; set; }

    [MaxLength(300)]
    public string PriorNote { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<GameSheetPlayer> GameSheetLines { get; set; } = new List<GameSheetPlayer>();
}
