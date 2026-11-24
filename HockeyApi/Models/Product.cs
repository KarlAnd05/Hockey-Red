using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>An item in the federation's shop.</summary>
public class Product
{
    public int Id { get; set; }

    [Required]
    [MaxLength(120)]
    public string Slug { get; set; } = null!;

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = null!;

    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Price in cents. Integer, never decimal: a jersey is 12900, not 129.00m.
    /// Money in a floating or badly-scaled type is where rounding bugs come
    /// from, and Stripe's API takes cents anyway.
    /// </summary>
    [Range(0, int.MaxValue)]
    public int PriceCents { get; set; }

    /// <summary>Nullable: deleting a category leaves its products uncategorised
    /// rather than deleting the products.</summary>
    public int? CategoryId { get; set; }
    public Category? Category { get; set; }

    [MaxLength(500)]
    public string ImageUrl { get; set; } = string.Empty;

    [Range(0, int.MaxValue)]
    public int Stock { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsFeatured { get; set; }

    /// <summary>Optional flash on the card - "New", "Last few".</summary>
    [MaxLength(40)]
    public string Badge { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
}
