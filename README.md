# Hockey-Api

An ASP.NET Core 10 backend for the Lebanese Ice Hockey Federation, on
PostgreSQL via EF Core.

Thirty-two entity classes covering the federation's full domain, hashed
passwords, and an API that is closed by default.

---

## 1. Prerequisites

- .NET SDK 10 (`dotnet --version`)
- PostgreSQL running locally (you have 18, service `postgresql-x64-18`)
- `dotnet-ef` (already installed: `dotnet ef --version`)

---

## 2. Settings and the connection string

Configuration is split in two, deliberately.

**`HockeyApi/appsettings.json` — committed, no secrets.** It holds the shape of
the configuration and placeholder values:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=hockeydb;Username=postgres;Password=__SET_IN_USER_SECRETS__"
  },
  "Jwt": {
    "Issuer": "HockeyApi",
    "Audience": "HockeyFrontEnd",
    "AccessTokenMinutes": 30,
    "RefreshTokenDays": 14
  },
  "Cors": { "AllowedOrigins": [ "http://localhost:5173", "http://localhost:5175" ] },
  "RateLimit": { "AuthAttempts": 5, "AuthWindowMinutes": 15 }
}
```

Note what is **not** in that file: `Jwt:Key`. There is no placeholder for it,
no default for it in code, and the application throws at startup if it is
missing. A signing key with a fallback is a master key printed in the source —
anyone who can read the repository can mint themselves an admin token.

**User Secrets — not committed, stored outside the project folder.** This is
where the real values go. Run these three from `Hockey-Api/HockeyApi`:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=hockeydb;Username=postgres;Password=YOUR_REAL_PASSWORD"
```

```bash
dotnet user-secrets set "Jwt:Key" "$(openssl rand -base64 48)"
```

```bash
dotnet user-secrets set "Seed:AdminPassword" "a long passphrase you choose"
```

The third is optional. Leave it out and the seeder generates a random admin
password and prints it once — which is on purpose, because a default password
in a source file is a published credential.

In production, use environment variables instead:
`ConnectionStrings__DefaultConnection`, `Jwt__Key`.

### About `<connectionStrings>`

You asked for `<connectionStrings>`, which is the **.NET Framework** Web.config
form:

```xml
<connectionStrings>
  <add name="DefaultConnection" connectionString="..." providerName="Npgsql" />
</connectionStrings>
```

ASP.NET Core does not read Web.config for this. It uses the
`"ConnectionStrings"` section of `appsettings.json` shown above, reached in
`Program.cs` with:

```csharp
builder.Configuration.GetConnectionString("DefaultConnection")
```

Same idea, different file — and the same call your BackEndBEL project already
makes. If an assignment specifically wants the XML form, say so and it can be
added alongside.

---

## 3. The migration script

Run these from `Hockey-Api/HockeyApi`.

```bash
dotnet restore
```

The migration is already generated and committed as
`Migrations/..._InitialHockeySchema.cs`. To create the database and apply it:

```bash
dotnet ef database update
```

To read the SQL before it touches anything:

```bash
dotnet ef migrations script --output migration.sql
```

To start over during development:

```bash
dotnet ef database drop --force
```

To regenerate the migration from scratch after changing a model:

```bash
dotnet ef migrations add InitialHockeySchema
```

Then run it:

```bash
dotnet run
```

Swagger is at `https://localhost:<port>/swagger` in development.

---

## 4. Checking it worked

**Passwords are genuinely hashed.** After `dotnet run` has seeded:

```bash
psql -h localhost -U postgres -d hockeydb -c "SELECT \"Email\", left(\"PasswordHash\", 24) FROM \"Users\";"
```

Every value starts with `AQAAAA` — the Identity format marker. No password
appears anywhere. Seeding the same password twice produces two different
hashes, because each user gets their own salt.

**There is no password column.**

```bash
psql -h localhost -U postgres -d hockeydb -c "\d \"Users\""
```

`PasswordHash` is there; `Password` does not exist. `IX_Users_Email` is unique.
Text columns are `character varying(n)`, not untyped `text`.

**Closed by default.** With no token:

```bash
curl -i https://localhost:7000/api/auth/me
```

401, not data.

**Login is uniform.** A wrong password and an unknown email return the same
message and take the same time. The second costs a full hash verification
against a decoy, so the response time cannot be used to discover which
addresses have accounts.

**Rate limiting bites.** Six bad logins from one address: the sixth returns 429.

---

## 5. What is in here

```
HockeyApi/
  Models/              32 entity classes + Enums.cs + Validation/
  Data/
    HockeyDbContext.cs
    HockeyDbContextFactory.cs    lets `dotnet ef` build the model without secrets
    Configurations/              keys, indexes, delete rules, check constraints
    DbSeeder.cs                  hashes everything it writes
  Security/
    PasswordHashingService.cs    PBKDF2-HMAC-SHA512, 210,000 iterations
    TokenHasher.cs               SHA-256 for opaque tokens
    JwtTokenService.cs
  Controllers/AuthController.cs  register / login / refresh / logout / me
  Dtos/AuthDtos.cs
  Program.cs
```

The 31 tables come from the federation's existing Node site, which already
models the domain properly. Two deliberate renames: `sessions` became
`RefreshToken` (with JWT, refreshing is what the row is actually for), and the
`programs` class is `ProgramEvent` because ASP.NET Core already generates a
`Program` class in this assembly — the table is still `Programs`.

## 6. What is not in here, on purpose

- **No CRUD controllers for the other 29 entities.** Only `AuthController`, to
  prove hashing works end to end. The rest is a larger, separate job.
- **No data migration from the existing SQLite database.** The live
  `Hockey-Red/data/store.db` holds real membership PII and was never opened.
