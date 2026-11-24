using System.Security.Cryptography;

namespace HockeyApi.Security;

/// <summary>
/// Opaque tokens - refresh tokens, password-reset links, a guest's order link,
/// a donor's manage link.
///
/// The rule for all of them is the same: the raw token is handed to exactly one
/// person once, and only its hash is written down. A database dump then yields
/// hashes, which cannot be replayed.
///
/// SHA-256 with no salt and no stretching is the right tool HERE and the wrong
/// one for passwords. These tokens are 256 bits of output from a cryptographic
/// random number generator, so there is no dictionary to attack and nothing for
/// iteration count to buy. A password is chosen by a human, which is why it gets
/// PBKDF2 instead. Do not use this class for passwords.
/// </summary>
public static class TokenHasher
{
    /// <summary>
    /// A fresh 256-bit token, base64url encoded so it is safe in a URL and in a
    /// cookie without further escaping.
    /// </summary>
    public static string NewToken()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Base64UrlEncode(bytes);
    }

    /// <summary>Lower-case hex SHA-256. 64 characters, which is what every
    /// TokenHash column is sized for.</summary>
    public static string Hash(string token)
    {
        ArgumentException.ThrowIfNullOrEmpty(token);
        var digest = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToHexStringLower(digest);
    }

    /// <summary>
    /// Compares two hashes without leaking, through timing, how many leading
    /// characters matched.
    /// </summary>
    public static bool HashesMatch(string a, string b)
    {
        if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b)) return false;
        return CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(a),
            System.Text.Encoding.UTF8.GetBytes(b));
    }

    private static string Base64UrlEncode(ReadOnlySpan<byte> bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
