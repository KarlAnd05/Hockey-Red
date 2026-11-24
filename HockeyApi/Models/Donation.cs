using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A gift, one-off or monthly.
///
/// Deliberately NOT an Order. A gift has no cart, no stock to decrement, no
/// shipping address and no order number; marking one paid must not clear the
/// donor's live shopping basket; and an invoice is one-per-order, so a monthly
/// gift could never have one receipt per cycle. Monthly giving also needs
/// states an order has no concept of - see DonationStatus.
/// </summary>
public class Donation
{
    public int Id { get; set; }

    public DonationKind Kind { get; set; } = DonationKind.OneTime;

    public DonationStatus Status { get; set; } = DonationStatus.Pending;

    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Message { get; set; } = string.Empty;

    public int AmountCents { get; set; }
    public int FeeCents { get; set; }
    public int TotalCents { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "cad";

    [MaxLength(255)]
    public string? StripeSessionId { get; set; }

    [MaxLength(255)]
    public string? StripeCustomerId { get; set; }

    [MaxLength(255)]
    public string? StripeSubscriptionId { get; set; }

    /// <summary>
    /// SHA-256 of the token that lets a donor manage a monthly gift without an
    /// account. Hashed, so the column cannot be used to cancel other people's
    /// subscriptions.
    /// </summary>
    [MaxLength(64)]
    public string? ManageTokenHash { get; set; }

    /// <summary>The donor's own choice. Defaults to false: a gift is private
    /// unless somebody opts in.</summary>
    public bool DisplayPublicly { get; set; }

    /// <summary>What to show on the public list - which may not be the name on
    /// the payment.</summary>
    [MaxLength(160)]
    public string PublicName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime? CanceledAt { get; set; }

    public ICollection<DonationPayment> Payments { get; set; } = new List<DonationPayment>();
}
