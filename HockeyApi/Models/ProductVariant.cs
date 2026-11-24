using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A size or colour of a product, with its own stock and an optional price
/// difference from the parent.
/// </summary>
public class ProductVariant
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = null!;

    /// <summary>Added to the product price. May be negative for a discounted size.</summary>
    public int PriceDeltaCents { get; set; }

    [Range(0, int.MaxValue)]
    public int Stock { get; set; }

    public int SortOrder { get; set; }
}
