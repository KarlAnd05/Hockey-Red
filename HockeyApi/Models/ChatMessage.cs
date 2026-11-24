using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>One line in a visitor conversation.</summary>
public class ChatMessage
{
    public int Id { get; set; }

    public int ThreadId { get; set; }
    public ChatThread Thread { get; set; } = null!;

    public ChatSender Sender { get; set; }

    [Required]
    [MaxLength(4000)]
    public string Body { get; set; } = null!;

    public DateTime? ReadAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
