using Microsoft.AspNetCore.Identity;
using HockeyApi.Models;

namespace HockeyApi.Security;

/// <summary>
/// Password hashing, wrapping ASP.NET Core Identity's PasswordHasher.
///
/// Why not write the PBKDF2 call directly: the Identity hasher already formats
/// the version marker, the salt and the iteration count into the stored string,
/// compares in constant time, and tells you when a hash needs upgrading. Those
/// are exactly the details that hand-rolled hashing gets wrong.
///
/// Settings: PBKDF2-HMAC-SHA512, 210,000 iterations, a 128-bit salt generated
/// per user. The iteration count is OWASP's 2023 floor for SHA512. Raising it
/// later is safe - every stored hash records the count it was made with, so old
/// hashes keep verifying and are re-hashed on next login.
///
/// No pepper. A pepper only helps if it lives somewhere the database dump does
/// not, which here would mean a key management story this project does not have
/// yet; adding one that sits in the same config as the connection string would
/// be theatre.
/// </summary>
public class PasswordHashingService : IPasswordHashingService
{
    private readonly PasswordHasher<User> _hasher;

    /// <summary>
    /// Hashed once at startup, not per request, so it costs nothing to use.
    /// The input is a constant because nothing is ever verified successfully
    /// against it - its only job is to be the right shape and the right cost.
    /// </summary>
    public string DecoyHash { get; }

    public PasswordHashingService()
    {
        var options = Microsoft.Extensions.Options.Options.Create(new PasswordHasherOptions
        {
            CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3,
            IterationCount = 210_000,
        });

        _hasher = new PasswordHasher<User>(options);
        DecoyHash = _hasher.HashPassword(new User(), "not-a-real-password");
    }

    public string Hash(string password)
    {
        ArgumentException.ThrowIfNullOrEmpty(password);
        return _hasher.HashPassword(new User(), password);
    }

    public PasswordCheck Verify(string storedHash, string password)
    {
        if (string.IsNullOrEmpty(storedHash) || string.IsNullOrEmpty(password))
            return PasswordCheck.Failed;

        return _hasher.VerifyHashedPassword(new User(), storedHash, password) switch
        {
            PasswordVerificationResult.Success => PasswordCheck.Success,
            PasswordVerificationResult.SuccessRehashNeeded => PasswordCheck.SuccessRehashNeeded,
            _ => PasswordCheck.Failed,
        };
    }
}
