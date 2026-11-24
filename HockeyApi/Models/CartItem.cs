using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// One line in a basket.
///
/// Note what is NOT here: a price. The line stores what was chosen and how
/// many; the price is read from the product at checkout time, on the server.
/// A cart that carried its own price would let a caller post a jersey at one
/// cent.
/// </summary>
public class CartItem
{
    public int Id { get; set; }

    public int CartId { get; set; }
    public Cart Cart { get; set; } = null!;

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public int? VariantId { get; set; }
    public ProductVariant? Variant { get; set; }

    [Range(1, int.MaxValue)]
    public int Quantity { get; set; }
}
