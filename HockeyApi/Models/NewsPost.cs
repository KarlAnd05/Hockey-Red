using System.ComponentModel.DataAnnotations;
using HockeyApi.Models.Validation;

namespace HockeyApi.Models;

/// <summary>
/// An article in the newsroom.
///
/// Each post has its own page so a shared link previews with its own title and
/// photo instead of the generic newsroom. The Share properties are filled in by
/// the admin, and only the ones actually set are offered in the share menu.
/// </summary>
public class NewsPost
{
    public int Id { get; set; }

    [Required]
    [MaxLength(160)]
    public string Slug { get; set; } = null!;

    [Required]
    [MaxLength(300)]
    public string Title { get; set; } = null!;

    [MaxLength(80)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(600)]
    public string Excerpt { get; set; } = string.Empty;

    /// <summary>No length cap: this is the article itself.</summary>
    public string Body { get; set; } = string.Empty;

    [MaxLength(500)]
    public string ImageUrl { get; set; } = string.Empty;

    [MaxLength(300)]
    public string ImageAlt { get; set; } = string.Empty;

    [MaxLength(160)]
    public string Author { get; set; } = string.Empty;

    [EmailAddress]
    [MaxLength(254)]
    public string ContactEmail { get; set; } = string.Empty;

    [OptionalPhone]
    [MaxLength(40)]
    public string ContactPhone { get; set; } = string.Empty;

    [MaxLength(500)]
    public string ShareFacebook { get; set; } = string.Empty;

    [MaxLength(500)]
    public string ShareInstagram { get; set; } = string.Empty;

    [MaxLength(500)]
    public string ShareX { get; set; } = string.Empty;

    /// <summary>Separate from CreatedAt so a post can be written now and
    /// published later.</summary>
    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
