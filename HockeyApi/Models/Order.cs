using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A placed order.
///
/// Every money column is cents and is calculated server-side from the cart and
/// the shipping zone. None of them is ever read from a request body.
/// </summary>
public class Order
{
    public int Id { get; set; }

    /// <summary>Human-facing reference, e.g. LIHF-2026-00001. Unique.</summary>
    [Required]
    [MaxLength(40)]
    public string OrderNumber { get; set; } = null!;

    /// <summary>
    /// Null for a guest checkout, and null again if the account is later
    /// deleted - the order itself must survive, because it is a financial
    /// record.
    /// </summary>
    public int? UserId { get; set; }
    public User? User { get; set; }

    public int? CartId { get; set; }
    public Cart? Cart { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; set; } = null!;

    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public int SubtotalCents { get; set; }
    public int DiscountCents { get; set; }
    public int ShippingCents { get; set; }
    public int TaxCents { get; set; }
    public int TotalCents { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "cad";

    [MaxLength(40)]
    public string DiscountCode { get; set; } = string.Empty;

    [MaxLength(40)]
    public string PaymentMethod { get; set; } = "card";

    [MaxLength(255)]
    public string? StripeSessionId { get; set; }

    [MaxLength(255)]
    public string? StripePaymentIntent { get; set; }

    /// <summary>
    /// Lets a guest open their own order from the confirmation email without an
    /// account. Stored hashed, like every other opaque token here, so the
    /// column cannot be used to read other people's orders.
    /// </summary>
    [MaxLength(64)]
    public string AccessTokenHash { get; set; } = string.Empty;

    [MaxLength(160)]
    public string ShipName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string ShipLine1 { get; set; } = string.Empty;

    [MaxLength(200)]
    public string ShipLine2 { get; set; } = string.Empty;

    [MaxLength(120)]
    public string ShipCity { get; set; } = string.Empty;

    [MaxLength(120)]
    public string ShipRegion { get; set; } = string.Empty;

    [MaxLength(40)]
    public string ShipPostal { get; set; } = string.Empty;

    /// <summary>ISO 3166-1 alpha-2.</summary>
    [MaxLength(2)]
    public string ShipCountry { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public Invoice? Invoice { get; set; }
}
