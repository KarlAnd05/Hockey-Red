using HockeyApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HockeyApi.Data.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.HasIndex(c => c.Slug).IsUnique();
    }
}

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasIndex(p => p.Slug).IsUnique();
        builder.HasIndex(p => p.CategoryId);

        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        /* [Range] on the model stops a bad API request. This stops a bad
           anything - a seed script, a psql session, a future background job.
           Validation in one layer is a convention; a constraint in the database
           is a guarantee. */
        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Products_PriceCents", "\"PriceCents\" >= 0");
            t.HasCheckConstraint("CK_Products_Stock", "\"Stock\" >= 0");
        });
    }
}

public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        builder.HasIndex(v => v.ProductId);

        builder.HasOne(v => v.Product)
            .WithMany(p => p.Variants)
            .HasForeignKey(v => v.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("CK_ProductVariants_Stock", "\"Stock\" >= 0"));
    }
}

public class DiscountConfiguration : IEntityTypeConfiguration<Discount>
{
    public void Configure(EntityTypeBuilder<Discount> builder)
    {
        builder.HasIndex(d => d.Code).IsUnique();

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Discounts_Value", "\"Value\" > 0");
            t.HasCheckConstraint("CK_Discounts_MinSubtotal", "\"MinSubtotalCents\" >= 0");
        });
    }
}
