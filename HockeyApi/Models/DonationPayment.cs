using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// One actual charge against a donation.
///
/// A monthly gift produces a paid invoice every cycle, and Stripe redelivers
/// webhooks. The unique index on StripeInvoiceId is what turns a replayed
/// webhook into a harmless no-op instead of a double count. Do not drop it.
/// </summary>
public class DonationPayment
{
    public int Id { get; set; }

    public int DonationId { get; set; }
    public Donation Donation { get; set; } = null!;

    /// <summary>Unique. This is the idempotency key for webhook replays.</summary>
    [MaxLength(255)]
    public string? StripeInvoiceId { get; set; }

    public int AmountCents { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "cad";

    public DonationPaymentStatus Status { get; set; } = DonationPaymentStatus.Paid;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
