using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// Editable page copy - one row per heading, paragraph or list item on a public
/// page.
///
/// DefaultValue mirrors what the source page says; Value is the federation's
/// edit and is what visitors see. Keeping both means a redeploy can change the
/// source text without silently discarding somebody's rewrite.
///
/// The key is a string primary key, not an int, because it is derived from the
/// page and element and is how the renderer looks a block up.
/// </summary>
public class ContentBlock
{
    [Required]
    [MaxLength(200)]
    public string Key { get; set; } = null!;

    [Required]
    [MaxLength(80)]
    public string Page { get; set; } = null!;

    /// <summary>The HTML element this block fills - h1, h2, p, li.</summary>
    [Required]
    [MaxLength(16)]
    public string Tag { get; set; } = null!;

    /// <summary>Which occurrence of that tag on the page.</summary>
    public int Nth { get; set; } = 1;

    [MaxLength(200)]
    public string Label { get; set; } = string.Empty;

    public string DefaultValue { get; set; } = string.Empty;

    /// <summary>Null means nobody has edited this block, so the default shows.
    /// An empty string is a real edit: it means somebody blanked it.</summary>
    public string? Value { get; set; }

    /// <summary>True once the source page no longer has this element. The row
    /// is kept rather than deleted so an edit is not lost by a reshuffle.</summary>
    public bool IsOrphaned { get; set; }

    public int SortOrder { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
