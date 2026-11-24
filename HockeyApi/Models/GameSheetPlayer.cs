using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// One person on one game sheet.
///
/// The line points at BOTH a player and a registration, and both are nullable:
/// PlayerId is the roster entry, which is what the public site shows, while
/// RegistrationId is the membership record, which carries the date of birth and
/// citizenship a game sheet actually needs. Most lines have both. A guest who
/// has registered but is not on a roster has only the second; a roster player
/// who has not filled the form in yet has only the first. Requiring either one
/// would make a real case unenterable.
///
/// Both use ON DELETE SET NULL rather than cascade: removing a player must not
/// silently erase the record that they played in a game.
/// </summary>
public class GameSheetPlayer
{
    public int Id { get; set; }

    public int GameId { get; set; }
    public Game Game { get; set; } = null!;

    public int? PlayerId { get; set; }
    public Player? Player { get; set; }

    public int? RegistrationId { get; set; }
    public Registration? Registration { get; set; }

    /// <summary>Written down as the sheet records it, so a later rename does
    /// not rewrite history.</summary>
    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    public int? JerseyNumber { get; set; }

    /// <summary>Free text: a game sheet may say something the roster's fixed
    /// list of positions does not cover.</summary>
    [MaxLength(40)]
    public string Position { get; set; } = string.Empty;

    public GameSheetRole Role { get; set; } = GameSheetRole.Player;

    /* Skater and goaltender figures. Zero is a real value - it means dressed
       and recorded nothing - which is why Played exists separately. */
    public int Goals { get; set; }
    public int Assists { get; set; }
    public int PenaltyMinutes { get; set; }
    public int ShotsAgainst { get; set; }
    public int Saves { get; set; }

    /// <summary>Goaltender decision: W, L, OTL and so on.</summary>
    [MaxLength(8)]
    public string Decision { get; set; } = string.Empty;

    /// <summary>False for a healthy scratch - named on the sheet, did not play.
    /// Without this, a scratch and a scoreless appearance are the same row.</summary>
    public bool Played { get; set; } = true;

    [MaxLength(300)]
    public string Note { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
