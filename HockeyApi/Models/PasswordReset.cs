using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A pending "forgot my password" request.
///
/// As with <see cref="RefreshToken"/>, only the hash of the emailed token is
/// kept, so the table cannot be used to take over accounts. BEL stores its
/// equivalent as a plain ResetToken string on the user row.
/// </summary>
public class PasswordReset
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    [Required]
    [MaxLength(64)]
    public string TokenHash { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    /// <summary>Stamped the moment the token is redeemed, so it is single-use.</summary>
    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
