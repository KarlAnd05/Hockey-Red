namespace HockeyApi.Models;

/// <summary>
/// A basket. Belongs either to a signed-in user or to an anonymous visitor.
///
/// The anonymous case is keyed by <see cref="SessionHash"/> - the hash of the
/// visitor's cart cookie, never the cookie itself - so a stolen database does
/// not hand anyone a working cart cookie.
/// </summary>
public class Cart
{
    public int Id { get; set; }

    /// <summary>Null for a guest cart.</summary>
    public int? UserId { get; set; }
    public User? User { get; set; }

    /// <summary>SHA-256 of the guest's cart token, hex-encoded. Null once the
    /// cart belongs to a signed-in user.</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(64)]
    public string? SessionHash { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<CartItem> Items { get; set; } = new List<CartItem>();
}
