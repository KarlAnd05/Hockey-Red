using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A record that an email was attempted.
///
/// The body is deliberately absent. Knowing that a receipt went out, and
/// whether it failed, is operationally useful; keeping a copy of every message
/// sent to a member is a second store of personal data to protect.
/// </summary>
public class EmailLog
{
    public int Id { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string ToAddress { get; set; } = null!;

    [Required]
    [MaxLength(300)]
    public string Subject { get; set; } = null!;

    /// <summary>Which template this was - order-receipt, reset-password, and so
    /// on. Free text, so adding a new kind of email is not a schema change.</summary>
    [MaxLength(60)]
    public string Kind { get; set; } = string.Empty;

    /// <summary>Not a foreign key: the log must survive the order being
    /// deleted, because the point of a log is that it outlives the thing it
    /// describes.</summary>
    public int? OrderId { get; set; }

    /// <summary>Logged means delivery was not configured, so the message was
    /// recorded instead of sent. It is not a failure.</summary>
    public EmailStatus Status { get; set; }

    [MaxLength(1000)]
    public string Error { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
