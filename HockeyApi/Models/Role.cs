using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>
/// A named role a user can hold. Kept as a table rather than a string column on
/// User so that [Authorize(Roles = "Admin")] has something real behind it and
/// so the set of roles can be listed without scanning every user row.
/// </summary>
public class Role
{
    public int Id { get; set; }

    [Required]
    [MaxLength(40)]
    public string Name { get; set; } = null!;

    public ICollection<User> Users { get; set; } = new List<User>();
}
