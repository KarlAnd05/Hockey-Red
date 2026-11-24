using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// One line of a placed order.
///
/// The name and variant are stored as snapshots, and the product reference is
/// nullable. That is deliberate: renaming a product, or deleting it, must not
/// rewrite what somebody was sold last year. An order is a record of a past
/// transaction, not a live view of the catalogue.
/// </summary>
public class OrderItem
{
    public int Id { get; set; }

    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int? ProductId { get; set; }
    public Product? Product { get; set; }

    public int? VariantId { get; set; }
    public ProductVariant? Variant { get; set; }

    /// <summary>The product name as it read when the order was placed.</summary>
    [Required]
    [MaxLength(200)]
    public string NameSnapshot { get; set; } = null!;

    [MaxLength(120)]
    public string VariantSnapshot { get; set; } = string.Empty;

    public int UnitPriceCents { get; set; }

    [Range(1, int.MaxValue)]
    public int Quantity { get; set; }

    public int LineTotalCents { get; set; }
}
