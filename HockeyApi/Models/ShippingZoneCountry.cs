using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// Maps one country to one zone. The pair is the primary key, so a country
/// cannot be assigned to two zones and quietly get whichever the query
/// happened to find first.
/// </summary>
public class ShippingZoneCountry
{
    public int ZoneId { get; set; }
    public ShippingZone Zone { get; set; } = null!;

    /// <summary>ISO 3166-1 alpha-2, upper case.</summary>
    [Required]
    [MaxLength(2)]
    public string CountryCode { get; set; } = null!;
}
