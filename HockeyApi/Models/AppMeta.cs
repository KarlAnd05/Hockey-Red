using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A small key/value store for state that must survive a restart but does not
/// earn a table of its own - for instance the Stripe product id reused for
/// every monthly gift, so the dashboard does not accumulate one product per
/// subscriber.
///
/// Keep it small. Anything that grows rows, needs querying by a second field,
/// or needs a foreign key has outgrown this table and wants its own.
/// </summary>
public class AppMeta
{
    [Required]
    [MaxLength(120)]
    public string Key { get; set; } = null!;

    [Required]
    [MaxLength(2000)]
    public string Value { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
