using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// One of the federation's programmes as a page people can visit.
///
/// The national / next-generation split lives on the <see cref="Player"/> as a
/// squad, not as extra teams: it is a grouping inside one programme.
/// </summary>
public class Team
{
    public int Id { get; set; }

    [Required]
    [MaxLength(80)]
    public string Slug { get; set; } = null!;

    [Required]
    [MaxLength(160)]
    public string Name { get; set; } = null!;

    [MaxLength(300)]
    public string Tagline { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string PhotoUrl { get; set; } = string.Empty;

    /// <summary>Alt text. Separate from the URL so a photo is never published
    /// without one.</summary>
    [MaxLength(300)]
    public string PhotoAlt { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Staff { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Honours { get; set; } = string.Empty;

    public TeamProgram? Program { get; set; }

    /// <summary>
    /// How a team comes off the public site. Several players are minors and a
    /// parent can ask for a name to be removed, so hiding has to be one toggle
    /// that every public query respects.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Player> Players { get; set; } = new List<Player>();
    public ICollection<Game> Games { get; set; } = new List<Game>();
    public ICollection<ProgramEvent> Programs { get; set; } = new List<ProgramEvent>();
}
