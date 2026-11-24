using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A long-lived token that buys a new access token without re-entering a
/// password. This is the `sessions` table of the existing site under an honest
/// name: with JWT the access token carries the session, so what the row is
/// actually for is refreshing it.
///
/// Only the SHA-256 of the token is stored. Someone who reads this table - a
/// leaked backup, a stray query - gets hashes, not working credentials.
/// </summary>
public class RefreshToken
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>SHA-256 of the token, hex-encoded. Never the token itself.</summary>
    [Required]
    [MaxLength(64)]
    public string TokenHash { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    /// <summary>Set when the token is used or the user signs out. A revoked
    /// token is kept rather than deleted so a replay can be spotted.</summary>
    public DateTime? RevokedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
