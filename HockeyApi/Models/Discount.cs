using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A promotional code.
///
/// Every limit a code can carry lives here rather than in the checkout code:
/// a window, a minimum spend, a redemption cap and an on/off switch. The
/// server applies them; the browser is never trusted to say what a code is
/// worth.
/// </summary>
public class Discount
{
    public int Id { get; set; }

    [Required]
    [MaxLength(40)]
    public string Code { get; set; } = null!;

    public DiscountType Type { get; set; }

    /// <summary>Percent off when Type is Percent, otherwise cents off.</summary>
    [Range(1, int.MaxValue)]
    public int Value { get; set; }

    public int MinSubtotalCents { get; set; }

    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    /// <summary>0 means unlimited.</summary>
    public int MaxRedemptions { get; set; }

    public int TimesRedeemed { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
