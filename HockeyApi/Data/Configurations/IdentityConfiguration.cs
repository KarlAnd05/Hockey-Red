using HockeyApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HockeyApi.Data.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.HasIndex(r => r.Name).IsUnique();

        /* Seeded here, in the migration, rather than in DbSeeder: a role is part
           of the schema's meaning, not sample data, and an [Authorize(Roles =
           "Admin")] attribute is worthless if the row it names might not exist.
           Fixed ids so re-running a migration cannot renumber them. */
        builder.HasData(
            new Role { Id = 1, Name = nameof(UserRole.Customer) },
            new Role { Id = 2, Name = nameof(UserRole.Admin) });
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        /* The unique index is what actually prevents duplicate accounts.
           Checking "does this email exist" before inserting is a race: two
           simultaneous registrations both see nothing and both insert. The
           index makes the second one fail, which the controller catches. */
        builder.HasIndex(u => u.Email).IsUnique();

        /* Emails are stored lower-cased by the registration path, because
           PostgreSQL compares text case-sensitively - without that,
           Karl@example.com and karl@example.com would be two accounts. */

        builder.HasOne(u => u.Role)
            .WithMany(r => r.Users)
            .HasForeignKey(u => u.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(u => u.RoleId).HasDefaultValue(1);
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.HasIndex(t => t.TokenHash).IsUnique();
        builder.HasIndex(t => t.UserId);

        builder.HasOne(t => t.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PasswordResetConfiguration : IEntityTypeConfiguration<PasswordReset>
{
    public void Configure(EntityTypeBuilder<PasswordReset> builder)
    {
        builder.HasIndex(p => p.TokenHash).IsUnique();
        builder.HasIndex(p => p.UserId);

        builder.HasOne(p => p.User)
            .WithMany(u => u.PasswordResets)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
