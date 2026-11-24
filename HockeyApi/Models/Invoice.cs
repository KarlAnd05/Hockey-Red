using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// The receipt issued for an order. One per order, enforced by a unique index
/// on <see cref="OrderId"/> so a retry cannot issue a second receipt for the
/// same money.
/// </summary>
public class Invoice
{
    public int Id { get; set; }

    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    [Required]
    [MaxLength(40)]
    public string InvoiceNumber { get; set; } = null!;

    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
}
