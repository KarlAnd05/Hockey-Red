using HockeyApi.Models;
using HockeyApi.Security;
using Microsoft.EntityFrameworkCore;

namespace HockeyApi.Data;

/// <summary>
/// Brings a development database up to date and puts the federation's real
/// reference data in it.
///
/// Three rules it follows that are worth stating:
///
/// 1. Every password it writes goes through the hasher. There is no literal
///    password anywhere in this file. A seeder that writes "admin123" straight
///    into the column does not just create a weak account - it proves the
///    column accepts plain text, and the login path has to accept it too for
///    the account to work at all.
///
/// 2. It is idempotent. Every block is guarded by a check, so running it on
///    every start in development adds nothing the second time.
///
/// 3. Nothing here is invented. The catalogue, teams, partners and news posts
///    below are the same records the Node site seeds in
///    Hockey-Red/server/db.js, server/lib/teams.js and server/lib/sponsors.js,
///    which is the federation's own copy. No row was copied out of the live
///    SQLite database - that file holds real member data and is not a seed.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<HockeyDbContext>();
        var passwords = services.GetRequiredService<IPasswordHashingService>();
        var config = services.GetRequiredService<IConfiguration>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder");

        await db.Database.MigrateAsync();

        await SeedUsersAsync(db, passwords, config, logger);
        await SeedShippingAsync(db);
        await SeedCatalogueAsync(db);
        await SeedDiscountsAsync(db);
        await SeedTeamsAsync(db);
        await SeedSponsorsAsync(db);
        await SeedNewsAsync(db);

        await db.SaveChangesAsync();
    }

    /* ======================================================================
       Identity
       ====================================================================== */

    private static async Task SeedUsersAsync(
        HockeyDbContext db,
        IPasswordHashingService passwords,
        IConfiguration config,
        ILogger logger)
    {
        if (await db.Users.AnyAsync()) return;

        var adminRoleId = await db.Roles
            .Where(r => r.Name == nameof(UserRole.Admin)).Select(r => r.Id).SingleAsync();
        var customerRoleId = await db.Roles
            .Where(r => r.Name == nameof(UserRole.Customer)).Select(r => r.Id).SingleAsync();

        var adminEmail = config["Seed:AdminEmail"] ?? "admin@lebanonhockey.local";

        /* No default password in this file.

           If one is not configured, a random one is generated and printed once.
           That is deliberately slightly inconvenient: a default that lives in
           source is a published credential, and the convenience of not having
           to look it up is exactly why it survives into production. */
        var adminPassword = config["Seed:AdminPassword"];
        var generated = false;

        if (string.IsNullOrWhiteSpace(adminPassword))
        {
            adminPassword = TokenHasher.NewToken();
            generated = true;
        }

        db.Users.Add(new User
        {
            Email = adminEmail.ToLowerInvariant(),
            PasswordHash = passwords.Hash(adminPassword),
            FirstName = "Federation",
            LastName = "Admin",
            RoleId = adminRoleId,
        });

        /* A customer-role account exists so the "closed by default" and PII
           checks can be run with a token that is genuinely not an admin's.
           Its password is random and discarded: sign in as this one by
           resetting it, not by looking it up. */
        db.Users.Add(new User
        {
            Email = "member@lebanonhockey.local",
            PasswordHash = passwords.Hash(TokenHasher.NewToken()),
            FirstName = "Demo",
            LastName = "Member",
            RoleId = customerRoleId,
        });

        await db.SaveChangesAsync();

        if (generated)
        {
            logger.LogWarning(
                "Seeded admin {Email} with a generated password: {Password}\n"
                + "This is printed once and is not stored anywhere in readable form. "
                + "Set Seed:AdminPassword in User Secrets to choose your own.",
                adminEmail, adminPassword);
        }
        else
        {
            logger.LogInformation("Seeded admin {Email} using the configured password.", adminEmail);
        }
    }

    /* ======================================================================
       Shipping
       ====================================================================== */

    private static async Task SeedShippingAsync(HockeyDbContext db)
    {
        if (await db.ShippingZones.AnyAsync()) return;

        /* The default zone has to exist before the first order, or a country
           nobody has mapped falls through to no charge at all. */
        var rest = new ShippingZone
        {
            Name = "Rest of world",
            FlatCents = 3500,
            PerItemCents = 500,
            IsDefault = true,
            DeliveryMinDays = 14,
            DeliveryMaxDays = 28,
            SortOrder = 99,
        };

        var canada = new ShippingZone
        {
            Name = "Canada",
            FlatCents = 1200,
            PerItemCents = 200,
            FreeOverCents = 15000,
            DeliveryMinDays = 3,
            DeliveryMaxDays = 8,
            SortOrder = 1,
            Countries = [new ShippingZoneCountry { CountryCode = "CA" }],
        };

        var lebanon = new ShippingZone
        {
            Name = "Lebanon",
            FlatCents = 900,
            DeliveryMinDays = 2,
            DeliveryMaxDays = 6,
            SortOrder = 2,
            Countries = [new ShippingZoneCountry { CountryCode = "LB" }],
        };

        db.ShippingZones.AddRange(rest, canada, lebanon);
        await db.SaveChangesAsync();
    }

    /* ======================================================================
       Catalogue

       Prices are integer cents, matching the Node store and Stripe. The
       apparel lines carry one variant per size with no price delta, and the
       size stock is the product stock spread across the sizes - the same
       arithmetic seedCatalogue() uses.
       ====================================================================== */

    private static readonly string[] ApparelSizes = ["XS", "S", "M", "L", "XL", "XXL"];

    private sealed record SeedProduct(
        string Slug,
        string Name,
        string Description,
        int PriceCents,
        string CategorySlug,
        int Stock,
        bool Featured = false,
        string Badge = "",
        bool Sized = false);

    private static readonly SeedProduct[] Catalogue =
    [
        new("official-team-lebanon-hockey-jersey", "Official Team Lebanon Hockey Jersey",
            "Custom-made game jersey in the national team colourway, with personalization options for name and number.",
            38500, "jerseys", 40, Featured: true, Badge: "Signature", Sized: true),

        new("official-team-lebanon-jacket", "Official Team Lebanon Jacket",
            "Team outerwear built for the rink and everywhere after it.",
            18000, "apparel", 35, Featured: true, Sized: true),

        new("crewneck-sweatshirt", "Crewneck Sweatshirt",
            "Official Team Lebanon pullover crewneck in heavyweight cotton blend.",
            7000, "apparel", 60, Sized: true),

        new("t-shirt", "T-Shirt",
            "Casual everyday team wear with the federation crest.",
            3500, "apparel", 90, Featured: true, Badge: "New", Sized: true),

        new("polo", "Polo",
            "Team-branded polo shirt for staff, officials, and supporters.",
            5000, "apparel", 50, Sized: true),

        new("cap", "Cap",
            "Official Team Lebanon baseball-style cap with adjustable strap.",
            4800, "headwear", 70),

        new("scarf", "Scarf",
            "Team-branded supporter scarf for game day.",
            3000, "apparel", 55),

        new("cedar-trophy", "Cedar Trophy",
            "Official LIHF commemorative trophy piece.",
            4000, "collectibles", 25),

        new("puck-with-holder", "Puck with Holder",
            "Collectible hockey puck with a display stand.",
            3000, "collectibles", 80),

        new("lihf-pucks", "LIHF Pucks",
            "Official Lebanese Ice Hockey Federation pucks.",
            2500, "collectibles", 120),

        new("official-lebanon-hockey-pin", "Official Lebanon Hockey Pin",
            "Collectible enamel pin with the cedar crest.",
            1500, "collectibles", 200),
    ];

    private static async Task SeedCatalogueAsync(HockeyDbContext db)
    {
        if (await db.Categories.AnyAsync()) return;

        var categories = new Dictionary<string, Category>
        {
            ["jerseys"] = new Category { Slug = "jerseys", Name = "Jerseys", SortOrder = 1 },
            ["apparel"] = new Category { Slug = "apparel", Name = "Apparel", SortOrder = 2 },
            ["headwear"] = new Category { Slug = "headwear", Name = "Headwear", SortOrder = 3 },
            ["collectibles"] = new Category { Slug = "collectibles", Name = "Collectibles", SortOrder = 4 },
        };

        db.Categories.AddRange(categories.Values);

        for (var i = 0; i < Catalogue.Length; i++)
        {
            var seed = Catalogue[i];

            var product = new Product
            {
                Slug = seed.Slug,
                Name = seed.Name,
                Description = seed.Description,
                PriceCents = seed.PriceCents,
                Category = categories[seed.CategorySlug],
                Stock = seed.Stock,
                IsFeatured = seed.Featured,
                Badge = seed.Badge,
                SortOrder = i,
            };

            if (seed.Sized)
            {
                var perSize = (int)Math.Ceiling(seed.Stock / (double)ApparelSizes.Length);
                for (var s = 0; s < ApparelSizes.Length; s++)
                {
                    product.Variants.Add(new ProductVariant
                    {
                        Name = ApparelSizes[s],
                        Stock = perSize,
                        SortOrder = s,
                    });
                }
            }

            db.Products.Add(product);
        }

        await db.SaveChangesAsync();
    }

    private static async Task SeedDiscountsAsync(HockeyDbContext db)
    {
        if (await db.Discounts.AnyAsync()) return;

        db.Discounts.Add(new Discount
        {
            Code = "CEDAR10",
            Type = DiscountType.Percent,
            Value = 10,
            MinSubtotalCents = 5000,
            MaxRedemptions = 0,      // 0 means unlimited
            IsActive = true,
        });

        await db.SaveChangesAsync();
    }

    /* ======================================================================
       Federation

       The four programme descriptions are the federation's own words, taken
       from its About Us document. They are kept identical to SEED_TEAMS in
       Hockey-Red/server/lib/teams.js; if one is reworded, reword both.
       ====================================================================== */

    private static async Task SeedTeamsAsync(HockeyDbContext db)
    {
        if (await db.Teams.AnyAsync()) return;

        db.Teams.AddRange(
            new Team
            {
                Slug = "womens",
                Name = "Women's National Program",
                Program = TeamProgram.Womens,
                Tagline = "National Team and Next Generation",
                Description =
                    "The women's programme began with players around the world asking for one, after the men's team "
                    + "drew attention to Lebanese hockey. It now fields a senior national team and a Next Generation "
                    + "squad, and has played friendlies and development programmes alongside Hockey Québec and Hockey "
                    + "Canada.",
                SortOrder = 0,
            },
            new Team
            {
                Slug = "mens",
                Name = "Men's National Program",
                Program = TeamProgram.Mens,
                Tagline = "Senior national team",
                Description =
                    "The federation's best-known programme, followed well beyond the Lebanese community. The squad is "
                    + "drawn from eastern and western Canada, the United States, France, Sweden and the United Arab "
                    + "Emirates - different routes to the same jersey, and the same reason for wearing it.",
                SortOrder = 1,
            },
            new Team
            {
                Slug = "youth",
                Name = "Youth Program",
                Program = TeamProgram.Youth,
                Tagline = "Development and pathway",
                Description =
                    "Youth development sits at the centre of the federation. It gives young players somewhere to build "
                    + "their skills and be seen internationally, with coaching aimed at the national squads. This is "
                    + "where most Lebanese players start.",
                SortOrder = 2,
            },
            new Team
            {
                Slug = "panthers",
                Name = "Lebanese Panthers",
                Program = TeamProgram.Panthers,
                Tagline = "Club team",
                Description =
                    "The club programme is for Lebanese players who want a competitive environment to train in through "
                    + "the season. It is the foundation under the national squads: where local talent is developed and "
                    + "prepared for international tournaments.",
                SortOrder = 3,
            });

        await db.SaveChangesAsync();
    }

    private static async Task SeedSponsorsAsync(HockeyDbContext db)
    {
        if (await db.Sponsors.AnyAsync()) return;

        /* Tier names here are the database's vocabulary (Platinum ... Partner).
           The federation's own rate card calls the top tier "Cedar". The two
           are not yet reconciled - see CONTENT-FROM-FEDERATION-PDFS.md in the
           Node project. */
        var gold = "Gold partners help fund facilities, professional coaching, and player experiences.";
        var silver = "Silver partners provide equipment, training, and other resources athletes need.";
        var bronze = "Bronze partners help make hockey accessible and enjoyable for everyone.";

        (string Name, SponsorTier Tier, string Blurb)[] sponsors =
        [
            ("PILLAR5", SponsorTier.Platinum, "Our lead partner, supporting the federation's biggest initiatives."),
            ("Egothera", SponsorTier.Gold, gold),
            ("Bawer", SponsorTier.Gold, gold),
            ("Canelle", SponsorTier.Gold, gold),
            ("Adonis", SponsorTier.Silver, silver),
            ("SLC", SponsorTier.Silver, silver),
            ("Mr. Mike's", SponsorTier.Bronze, bronze),
        ];

        for (var i = 0; i < sponsors.Length; i++)
        {
            db.Sponsors.Add(new Sponsor
            {
                Name = sponsors[i].Name,
                Tier = sponsors[i].Tier,
                Blurb = sponsors[i].Blurb,
                SortOrder = i,
            });
        }

        await db.SaveChangesAsync();
    }

    private static async Task SeedNewsAsync(HockeyDbContext db)
    {
        if (await db.NewsPosts.AnyAsync()) return;

        db.NewsPosts.AddRange(
            new NewsPost
            {
                Slug = "ricardo-tabet-named-mens-gm",
                Title = "Ricardo Tabet Named Men's GM",
                Category = "Management",
                Excerpt = "Ricardo Tabet has joined the federation as General Manager of the Men's National Team.",
                Body =
                    "Ricardo Tabet has joined the federation as General Manager of the Men's National Team, "
                    + "bringing his background as a former player and team captain to the role.",
                Author = "Lebanese Ice Hockey Federation",
                ContactEmail = "ricardo.tabet@lebanonhockey.com",
                ContactPhone = "+1 514-575-4419",
                PublishedAt = new DateTime(2023, 3, 13, 0, 0, 0, DateTimeKind.Utc),
                SortOrder = 1,
            },
            new NewsPost
            {
                Slug = "jocelyn-trepanier-joins-womens-program",
                Title = "Jocelyn Trépanier Joins Women's Program",
                Category = "Coaching",
                Excerpt = "Appointed General Manager and Co-Head Coach of the Women's National Team.",
                Body =
                    "Jocelyn Trépanier has been appointed General Manager and Co-Head Coach of the Women's "
                    + "National Team, bringing a decade of competitive minor hockey management experience.\n\n"
                    + "His expertise and passion for the sport will contribute to the continued growth of the "
                    + "Women's National Team program.",
                Author = "Charles El-Mir",
                ContactEmail = "jocelyn.trepanier@lebanonhockey.com",
                ContactPhone = "+1 613-724-7680",
                PublishedAt = new DateTime(2025, 6, 23, 0, 0, 0, DateTimeKind.Utc),
                SortOrder = 2,
            },
            new NewsPost
            {
                Slug = "gregg-kennedy-named-mens-head-coach",
                Title = "Gregg Kennedy Named Men's Head Coach",
                Category = "Coaching",
                Excerpt = "Gregg Kennedy takes on Head Coach and development coordinator for the Men's National Team.",
                Body =
                    "Gregg Kennedy has taken on the role of Head Coach and development coordinator for the Men's "
                    + "National Team, drawing on roughly three decades of coaching and player development experience.",
                Author = "Lebanese Ice Hockey Federation",
                ContactEmail = "gregg.kennedy@lebanonhockey.com",
                ContactPhone = "+1 613-612-9499",
                PublishedAt = new DateTime(2022, 9, 12, 0, 0, 0, DateTimeKind.Utc),
                SortOrder = 3,
            });

        await db.SaveChangesAsync();
    }
}
