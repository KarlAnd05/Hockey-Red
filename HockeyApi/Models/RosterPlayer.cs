using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A line on a published roster table.
///
/// Kept separate from <see cref="Player"/> because it is a different thing: a
/// flat published list keyed to a programme and squad, with no photo, no
/// biography and no page of its own. The men's programme has no roster yet,
/// so the men's page must render an empty state rather than an empty table.
/// </summary>
public class RosterPlayer
{
    public int Id { get; set; }

    public RosterProgram Program { get; set; }

    public SquadLevel Squad { get; set; } = SquadLevel.National;

    public RosterPosition Position { get; set; }

    public int? JerseyNumber { get; set; }

    [Required]
    [MaxLength(160)]
    public string Name { get; set; } = null!;

    [MaxLength(160)]
    public string RecentTeam { get; set; } = string.Empty;

    [MaxLength(160)]
    public string Resides { get; set; } = string.Empty;

    [MaxLength(160)]
    public string Hometown { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
