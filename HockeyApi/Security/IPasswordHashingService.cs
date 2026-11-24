namespace HockeyApi.Security;

/// <summary>What checking a password produced.</summary>
public enum PasswordCheck
{
    /// <summary>Wrong password. Say nothing more specific than that to the caller.</summary>
    Failed,

    Success,

    /// <summary>
    /// Correct, but the stored hash used weaker settings than the ones in force
    /// now. The caller should re-hash and save while it holds the plain-text,
    /// which is the only moment it ever can.
    /// </summary>
    SuccessRehashNeeded,
}

public interface IPasswordHashingService
{
    /// <summary>Hashes a password for storage. Never store the input.</summary>
    string Hash(string password);

    /// <summary>Checks a password against a stored hash in constant time.</summary>
    PasswordCheck Verify(string storedHash, string password);

    /// <summary>
    /// A real hash of a value nobody knows, used to make a login attempt for an
    /// unknown email cost the same as one for a known email. See the remarks on
    /// the implementation.
    /// </summary>
    string DecoyHash { get; }
}
