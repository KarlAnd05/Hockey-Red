using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HockeyApi.Models;
using Microsoft.IdentityModel.Tokens;

namespace HockeyApi.Security;

public interface IJwtTokenService
{
    /// <summary>Mints a short-lived access token for a user.</summary>
    (string Token, DateTime ExpiresAt) CreateAccessToken(User user);

    /// <summary>How long a refresh token is good for, from configuration.</summary>
    TimeSpan RefreshTokenLifetime { get; }
}

/// <summary>
/// Issues the access tokens.
///
/// Thirty minutes by default, not days. A JWT cannot be revoked once issued -
/// that is the trade for not hitting the database on every request - so the
/// only real control over a stolen token is how soon it stops working. The
/// refresh token covers the gap, and that one IS revocable, because it is a
/// row in a table.
/// </summary>
public class JwtTokenService : IJwtTokenService
{
    private readonly string _key;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _accessMinutes;

    public TimeSpan RefreshTokenLifetime { get; }

    public JwtTokenService(IConfiguration configuration)
    {
        // Program.cs has already refused to start if any of these are missing.
        _key = configuration["Jwt:Key"]!;
        _issuer = configuration["Jwt:Issuer"]!;
        _audience = configuration["Jwt:Audience"]!;
        _accessMinutes = configuration.GetValue("Jwt:AccessTokenMinutes", 30);

        RefreshTokenLifetime = TimeSpan.FromDays(configuration.GetValue("Jwt:RefreshTokenDays", 14));
    }

    public (string Token, DateTime ExpiresAt) CreateAccessToken(User user)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(_accessMinutes);

        /* What goes in a token: an id, a role, an email, and nothing else.

           A JWT is signed, not encrypted - anyone holding it can read every
           claim, and it travels through browsers, logs and proxies. So it
           carries what authorisation needs and no personal data beyond the
           address the user already typed in to sign in. */
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role?.Name ?? nameof(UserRole.Customer)),

            // Unique per token, so an individual token can be denylisted later.
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
