using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A camp, session or tournament on the schedule.
///
/// Named ProgramEvent rather than Program because ASP.NET Core generates a
/// class called Program for the application entry point in this same assembly;
/// two would collide. The table is still Programs.
/// </summary>
public class ProgramEvent
{
    public int Id { get; set; }

    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = null!;

    /// <summary>Camp, session or tournament - free text while the federation
    /// settles its own vocabulary.</summary>
    [MaxLength(40)]
    public string Kind { get; set; } = "program";

    /* Dates, not timestamps. A camp runs on a day, not at an instant, and
       storing an instant would drag timezone handling into a page that does
       not need it. */
    public DateOnly? StartsAt { get; set; }
    public DateOnly? EndsAt { get; set; }

    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string LinkUrl { get; set; } = string.Empty;

    [MaxLength(120)]
    public string LinkLabel { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
