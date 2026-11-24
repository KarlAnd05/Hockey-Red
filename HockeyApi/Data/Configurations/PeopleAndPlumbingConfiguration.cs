using HockeyApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HockeyApi.Data.Configurations;

public class RegistrationConfiguration : IEntityTypeConfiguration<Registration>
{
    public void Configure(EntityTypeBuilder<Registration> builder)
    {
        builder.HasIndex(r => new { r.PaymentStatus, r.CreatedAt });
        builder.HasIndex(r => r.StripeSessionId);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Registrations_Amount", "\"AmountCents\" >= 0");

            /* A date of birth before anyone alive was born is a typo or an
               attack, not a member.

               The matching "not in the future" rule is NOT here, because it
               would need CURRENT_DATE - and PostgreSQL requires a check
               expression to be immutable, since it is re-evaluated when a dump
               is restored. A constraint whose truth depends on the clock can
               make a backup refuse to load. That rule lives on the model
               instead, as [NotInTheFuture]. */
            t.HasCheckConstraint(
                "CK_Registrations_DateOfBirth",
                "\"DateOfBirth\" IS NULL OR \"DateOfBirth\" > DATE '1900-01-01'");
        });
    }
}

public class DonationConfiguration : IEntityTypeConfiguration<Donation>
{
    public void Configure(EntityTypeBuilder<Donation> builder)
    {
        builder.HasIndex(d => d.Status);
        builder.HasIndex(d => d.StripeSessionId);
        builder.HasIndex(d => d.StripeSubscriptionId);
        builder.HasIndex(d => d.ManageTokenHash);

        builder.ToTable(t => t.HasCheckConstraint(
            "CK_Donations_Amounts",
            "\"AmountCents\" >= 0 AND \"FeeCents\" >= 0 AND \"TotalCents\" >= 0"));
    }
}

public class DonationPaymentConfiguration : IEntityTypeConfiguration<DonationPayment>
{
    public void Configure(EntityTypeBuilder<DonationPayment> builder)
    {
        builder.HasIndex(p => p.DonationId);

        /* The idempotency key for Stripe webhook replays. A monthly gift bills
           every cycle and Stripe redelivers; this unique index is what turns a
           replay into a harmless no-op instead of a double count. Do not drop
           it. */
        builder.HasIndex(p => p.StripeInvoiceId).IsUnique();

        builder.HasOne(p => p.Donation)
            .WithMany(d => d.Payments)
            .HasForeignKey(p => p.DonationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ContactMessageConfiguration : IEntityTypeConfiguration<ContactMessage>
{
    public void Configure(EntityTypeBuilder<ContactMessage> builder)
    {
        builder.HasIndex(m => m.CreatedAt).IsDescending();
    }
}

public class ChatThreadConfiguration : IEntityTypeConfiguration<ChatThread>
{
    public void Configure(EntityTypeBuilder<ChatThread> builder)
    {
        builder.HasIndex(t => t.TokenHash).IsUnique();
        builder.HasIndex(t => new { t.Status, t.LastMessageAt });
    }
}

public class ChatMessageConfiguration : IEntityTypeConfiguration<ChatMessage>
{
    public void Configure(EntityTypeBuilder<ChatMessage> builder)
    {
        builder.HasIndex(m => new { m.ThreadId, m.Id });

        builder.HasOne(m => m.Thread)
            .WithMany(t => t.Messages)
            .HasForeignKey(m => m.ThreadId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ContentBlockConfiguration : IEntityTypeConfiguration<ContentBlock>
{
    public void Configure(EntityTypeBuilder<ContentBlock> builder)
    {
        /* The key is the natural identifier - it is derived from the page and
           the element, and it is how the renderer looks a block up. A surrogate
           int would add a second identity for no gain. */
        builder.HasKey(b => b.Key);
        builder.HasIndex(b => b.Page);
    }
}

public class EmailLogConfiguration : IEntityTypeConfiguration<EmailLog>
{
    public void Configure(EntityTypeBuilder<EmailLog> builder)
    {
        /* Indexed, but deliberately not a foreign key: a log has to outlive the
           thing it describes, or it stops being a log. */
        builder.HasIndex(e => e.OrderId);
        builder.HasIndex(e => e.CreatedAt).IsDescending();
    }
}

public class AppMetaConfiguration : IEntityTypeConfiguration<AppMeta>
{
    public void Configure(EntityTypeBuilder<AppMeta> builder)
    {
        builder.HasKey(m => m.Key);
    }
}
