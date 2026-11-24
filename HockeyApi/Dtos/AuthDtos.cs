using System.ComponentModel.DataAnnotations;
using HockeyApi.Models.Validation;

namespace HockeyApi.Dtos;

/* Why DTOs at all, when the entity classes already have the same fields.

   Binding a request straight onto an entity is over-posting: the model binder
   fills in every property the JSON mentions, so a caller who adds
   "roleId": 2 to a registration body makes themselves an admin, and nothing in
   the controller looks wrong. The request types below simply have no such
   property to fill.

   The same in reverse. Returning an entity serialises whatever it happens to
   carry today - and whatever somebody adds to it next year. A PasswordHash
   column leaks the first time someone writes return Ok(user). The response
   types below say exactly what leaves the server. */

public record RegisterRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; init; } = null!;

    /// <summary>
    /// Twelve characters minimum, and no maximum worth mentioning - length is
    /// what makes a password hard to guess, and a short cap usually means the
    /// password is being stored somewhere it should not be. A passphrase must
    /// fit.
    /// </summary>
    [Required]
    [MinLength(12, ErrorMessage = "Use at least 12 characters. A short phrase is fine.")]
    [MaxLength(256)]
    public string Password { get; init; } = null!;

    [Required]
    [MaxLength(80)]
    public string FirstName { get; init; } = string.Empty;

    [Required]
    [MaxLength(80)]
    public string LastName { get; init; } = string.Empty;

    [OptionalPhone]
    [MaxLength(40)]
    public string Phone { get; init; } = string.Empty;
}

public record LoginRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; init; } = null!;

    [Required]
    [MaxLength(256)]
    public string Password { get; init; } = null!;
}

public record RefreshRequest
{
    [Required]
    [MaxLength(128)]
    public string RefreshToken { get; init; } = null!;
}

/// <summary>What a successful sign-in hands back.</summary>
public record AuthResponse
{
    public required string AccessToken { get; init; }
    public required DateTime AccessTokenExpiresAt { get; init; }

    /// <summary>
    /// The only time this value exists in readable form. The server keeps its
    /// SHA-256 and cannot show it again.
    /// </summary>
    public required string RefreshToken { get; init; }
    public required DateTime RefreshTokenExpiresAt { get; init; }

    public required UserResponse User { get; init; }
}

/// <summary>
/// A user as the API describes one. Note what is missing: PasswordHash, and
/// every token. It is missing because this type never had it, not because
/// somebody remembered to strip it.
/// </summary>
public record UserResponse
{
    public required int Id { get; init; }
    public required string Email { get; init; }
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required string Role { get; init; }
}
