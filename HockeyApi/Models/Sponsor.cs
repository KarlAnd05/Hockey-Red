using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A partner shown on the sponsors page.
///
/// The page sorts itself by Tier, so a sponsor moves up by changing their tier
/// rather than by being re-sorted by hand.
/// </summary>
public class Sponsor
{
    public int Id { get; set; }

    [Required]
    [MaxLength(160)]
    public string Name { get; set; } = null!;

    public SponsorTier Tier { get; set; } = SponsorTier.Bronze;

    [MaxLength(1000)]
    public string Blurb { get; set; } = string.Empty;

    [MaxLength(500)]
    public string WebsiteUrl { get; set; } = string.Empty;

    [MaxLength(500)]
    public string LogoUrl { get; set; } = string.Empty;

    [MaxLength(300)]
    public string LogoAlt { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
