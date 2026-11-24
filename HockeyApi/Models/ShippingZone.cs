using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A shipping band: a base fee, an optional per-item fee, an optional
/// free-over threshold and a delivery estimate, covering a list of countries.
///
/// Exactly one zone is <see cref="IsDefault"/>. A country nobody has mapped
/// yet must land on that zone rather than falling through to zero - a silent
/// free shipment to the other side of the world is the failure mode worth
/// designing against.
/// </summary>
public class ShippingZone
{
    public int Id { get; set; }

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = null!;

    public int FlatCents { get; set; }

    public int PerItemCents { get; set; }

    /// <summary>0 disables free shipping for this zone.</summary>
    public int FreeOverCents { get; set; }

    public int DeliveryMinDays { get; set; } = 14;
    public int DeliveryMaxDays { get; set; } = 21;

    /// <summary>The fallback for any country not listed in a zone.</summary>
    public bool IsDefault { get; set; }

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ShippingZoneCountry> Countries { get; set; } = new List<ShippingZoneCountry>();
}
