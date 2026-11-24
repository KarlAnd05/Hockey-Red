using System.ComponentModel.DataAnnotations;
using HockeyApi.Models.Validation;

namespace HockeyApi.Models;

/// <summary>
/// An account that can sign in.
///
/// There is deliberately NO Password property on this class - only
/// <see cref="PasswordHash"/>. A plain-text password has nowhere to live here,
/// so it cannot be persisted by accident, cannot be returned by a careless
/// projection, and cannot be compared with == in a controller. The only way to
/// check one is through IPasswordHashingService.
/// </summary>
public class User
{
    public int Id { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(254)] // the maximum length of an email address per RFC 5321
    public string Email { get; set; } = null!;

    /// <summary>
    /// PBKDF2-HMAC-SHA512, per-user salt, produced by PasswordHashingService.
    /// Long enough for the format's version byte, salt and subkey, with room
    /// for a future algorithm that needs more.
    /// </summary>
    [Required]
    [MaxLength(256)]
    public string PasswordHash { get; set; } = null!;

    [Required]
    [MaxLength(80)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [MaxLength(80)]
    public string LastName { get; set; } = string.Empty;

    [OptionalPhone]
    [MaxLength(40)]
    public string Phone { get; set; } = string.Empty;

    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;

    /// <summary>
    /// False locks the account out. Checked during login, but only after the
    /// password has been verified, so it cannot be used to discover which
    /// addresses have accounts.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Cart> Carts { get; set; } = new List<Cart>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<PasswordReset> PasswordResets { get; set; } = new List<PasswordReset>();
}
