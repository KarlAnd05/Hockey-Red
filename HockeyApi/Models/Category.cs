using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models;

/// <summary>A shop section - jerseys, training wear, accessories.</summary>
public class Category
{
    public int Id { get; set; }

    /// <summary>URL segment. Unique, so /shop/jerseys can never be ambiguous.</summary>
    [Required]
    [MaxLength(80)]
    public string Slug { get; set; } = null!;

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = null!;

    public int SortOrder { get; set; }

    public ICollection<Product> Products { get; set; } = new List<Product>();
}
