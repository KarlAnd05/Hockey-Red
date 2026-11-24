using HockeyApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HockeyApi.Data.Configurations;

public class CartConfiguration : IEntityTypeConfiguration<Cart>
{
    public void Configure(EntityTypeBuilder<Cart> builder)
    {
        builder.HasIndex(c => c.UserId);
        builder.HasIndex(c => c.SessionHash);

        builder.HasOne(c => c.User)
            .WithMany(u => u.Carts)
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class CartItemConfiguration : IEntityTypeConfiguration<CartItem>
{
    public void Configure(EntityTypeBuilder<CartItem> builder)
    {
        builder.HasIndex(i => i.CartId);

        builder.HasOne(i => i.Cart)
            .WithMany(c => c.Items)
            .HasForeignKey(i => i.CartId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.Variant)
            .WithMany()
            .HasForeignKey(i => i.VariantId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.ToTable(t => t.HasCheckConstraint("CK_CartItems_Quantity", "\"Quantity\" > 0"));
    }
}

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasIndex(o => o.OrderNumber).IsUnique();
        builder.HasIndex(o => o.UserId);
        builder.HasIndex(o => o.Status);
        builder.HasIndex(o => o.StripeSessionId);

        /* A refund webhook looks an order up by payment intent. Without this
           index that is a sequential scan of every order ever placed. */
        builder.HasIndex(o => o.StripePaymentIntent);

        /* SetNull, not Cascade and not Restrict.

           Cascade would destroy financial records when an account is closed.
           Restrict would make an account undeletable the moment it ordered
           anything, which collides with a member's right to have their data
           erased. SetNull keeps the order and drops the link - the order still
           carries the email and address it was shipped to, and those are
           cleared separately if erasure is requested. */
        builder.HasOne(o => o.User)
            .WithMany(u => u.Orders)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(o => o.Cart)
            .WithMany()
            .HasForeignKey(o => o.CartId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Orders_Totals",
                "\"SubtotalCents\" >= 0 AND \"DiscountCents\" >= 0 AND \"ShippingCents\" >= 0 "
                + "AND \"TaxCents\" >= 0 AND \"TotalCents\" >= 0");
        });
    }
}

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.HasIndex(i => i.OrderId);

        builder.HasOne(i => i.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        /* SetNull on both: delisting a product must not rewrite what somebody
           was sold. The snapshot columns are what the receipt prints. */
        builder.HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(i => i.Variant)
            .WithMany()
            .HasForeignKey(i => i.VariantId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.ToTable(t => t.HasCheckConstraint("CK_OrderItems_Quantity", "\"Quantity\" > 0"));
    }
}

public class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.HasIndex(i => i.InvoiceNumber).IsUnique();

        /* One invoice per order, enforced by the database. A retried webhook or
           a double-clicked button cannot issue a second receipt for the same
           money. */
        builder.HasOne(i => i.Order)
            .WithOne(o => o.Invoice)
            .HasForeignKey<Invoice>(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ShippingZoneConfiguration : IEntityTypeConfiguration<ShippingZone>
{
    public void Configure(EntityTypeBuilder<ShippingZone> builder)
    {
        /* Exactly one default zone. A partial unique index is how PostgreSQL
           expresses "unique among the rows where this is true", and it is what
           stops a second default being saved - the fallback has to be
           unambiguous, or an unmapped country gets whichever row the query
           happened to find first. */
        builder.HasIndex(z => z.IsDefault)
            .IsUnique()
            .HasFilter("\"IsDefault\" = true");

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_ShippingZones_Fees",
                "\"FlatCents\" >= 0 AND \"PerItemCents\" >= 0 AND \"FreeOverCents\" >= 0");
            t.HasCheckConstraint("CK_ShippingZones_Delivery",
                "\"DeliveryMinDays\" >= 0 AND \"DeliveryMaxDays\" >= \"DeliveryMinDays\"");
        });
    }
}

public class ShippingZoneCountryConfiguration : IEntityTypeConfiguration<ShippingZoneCountry>
{
    public void Configure(EntityTypeBuilder<ShippingZoneCountry> builder)
    {
        /* The pair is the key, so one country cannot sit in two zones and
           silently get whichever was read first. */
        builder.HasKey(c => new { c.ZoneId, c.CountryCode });
        builder.HasIndex(c => c.CountryCode);

        builder.HasOne(c => c.Zone)
            .WithMany(z => z.Countries)
            .HasForeignKey(c => c.ZoneId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
