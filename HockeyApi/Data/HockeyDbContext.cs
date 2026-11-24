using HockeyApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace HockeyApi.Data;

/// <summary>
/// The federation's database.
///
/// Every table's keys, indexes, lengths and delete rules live in
/// Data/Configurations rather than in attributes on the entities, so the model
/// classes stay readable and the persistence decisions are all in one place.
/// </summary>
public class HockeyDbContext : DbContext
{
    public HockeyDbContext(DbContextOptions<HockeyDbContext> options) : base(options) { }

    // Identity and access
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordReset> PasswordResets => Set<PasswordReset>();

    // Catalogue
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Discount> Discounts => Set<Discount>();

    // Cart and orders
    public DbSet<Cart> Carts => Set<Cart>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<ShippingZone> ShippingZones => Set<ShippingZone>();
    public DbSet<ShippingZoneCountry> ShippingZoneCountries => Set<ShippingZoneCountry>();

    // Federation
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Player> Players => Set<Player>();
    public DbSet<RosterPlayer> RosterPlayers => Set<RosterPlayer>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<GameSheetPlayer> GameSheetPlayers => Set<GameSheetPlayer>();
    public DbSet<ProgramEvent> Programs => Set<ProgramEvent>();
    public DbSet<Sponsor> Sponsors => Set<Sponsor>();
    public DbSet<NewsPost> NewsPosts => Set<NewsPost>();

    // People and money
    public DbSet<Registration> Registrations => Set<Registration>();
    public DbSet<Donation> Donations => Set<Donation>();
    public DbSet<DonationPayment> DonationPayments => Set<DonationPayment>();

    // Site plumbing
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<ChatThread> ChatThreads => Set<ChatThread>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<ContentBlock> ContentBlocks => Set<ContentBlock>();
    public DbSet<EmailLog> EmailLogs => Set<EmailLog>();
    public DbSet<AppMeta> AppMeta => Set<AppMeta>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Picks up every IEntityTypeConfiguration in Data/Configurations.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HockeyDbContext).Assembly);

        StoreEnumsAsText(modelBuilder);
    }

    /// <summary>
    /// Stores every enum property as its name rather than its ordinal.
    ///
    /// Two reasons. A column reading 'Refunded' is legible in psql and in a CSV
    /// export, where a 4 is not. And an ordinal silently changes meaning the
    /// moment somebody inserts a value in the middle of the enum - every
    /// existing row then means something different, with no error anywhere.
    /// Text has neither failure mode.
    ///
    /// Done in a loop rather than property by property so that an enum added
    /// later cannot be forgotten.
    /// </summary>
    private static void StoreEnumsAsText(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                var clrType = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                if (!clrType.IsEnum) continue;

                var converter = (ValueConverter)Activator.CreateInstance(
                    typeof(EnumToStringConverter<>).MakeGenericType(clrType))!;

                property.SetValueConverter(converter);

                // Longest member name across every enum in this model, rounded
                // up. Without this the column would be unbounded text.
                property.SetMaxLength(32);
            }
        }
    }
}
