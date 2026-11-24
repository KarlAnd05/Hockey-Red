using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A visitor conversation.
///
/// A thread is identified by a token the visitor's browser keeps, NOT by their
/// sign-in session: a session token rotates on login and is purged on expiry,
/// and either would strand a conversation mid-sentence. Only the hash is kept
/// here; the raw token lives in the visitor's browser and nowhere else.
/// </summary>
public class ChatThread
{
    public int Id { get; set; }

    [Required]
    [MaxLength(64)]
    public string TokenHash { get; set; } = null!;

    [MaxLength(160)]
    public string VisitorName { get; set; } = string.Empty;

    [EmailAddress]
    [MaxLength(254)]
    public string VisitorEmail { get; set; } = string.Empty;

    /// <summary>Blocked is how an abusive thread is shut without deleting the
    /// evidence.</summary>
    public ChatStatus Status { get; set; } = ChatStatus.Open;

    public DateTime? LastMessageAt { get; set; }

    /// <summary>When the admin was last emailed about this thread. Exists so a
    /// visitor typing five short lines does not send five separate emails.</summary>
    public DateTime? NotifiedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
