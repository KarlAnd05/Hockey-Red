using System.Text;
using System.Threading.RateLimiting;
using HockeyApi.Data;
using HockeyApi.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

/* ===========================================================================
   Configuration: fail fast, never fall back
   ---------------------------------------------------------------------------
   Every secret below is read with no default. If one is missing the app throws
   at startup and stops.

   This is the single most important decision in this file. A signing key with
   a fallback value is not a convenience - it is a master key printed in the
   source, and anyone who can read the repository can mint themselves an admin
   token with it. Refusing to start is loud, happens on the developer's machine
   rather than in production, and cannot be ignored.
   =========================================================================== */

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection is not configured. "
        + "Set it with: dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"...\"");

if (connectionString.Contains("__SET_IN_USER_SECRETS__", StringComparison.Ordinal))
    throw new InvalidOperationException(
        "The connection string is still the placeholder from appsettings.json. "
        + "Set the real one in User Secrets - see README.md.");

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "Jwt:Key is not configured. Generate one and set it with: "
        + "dotnet user-secrets set \"Jwt:Key\" \"<48 random bytes, base64>\"");

/* HMAC-SHA256 keys shorter than the hash output weaken the signature. 32 bytes
   is the floor; the README generates 48. */
if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException(
        $"Jwt:Key must be at least 32 bytes; it is {Encoding.UTF8.GetByteCount(jwtKey)}.");

var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Jwt:Issuer is not configured.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Jwt:Audience is not configured.");

// ===========================================================================
// Services
// ===========================================================================

builder.Services.AddDbContext<HockeyDbContext>(options =>
{
    options.UseNpgsql(connectionString);

    /* Parameter values appear in logs and in exception messages when these are
       on. In this database those values are dates of birth and citizenships, so
       they stay off outside development. */
    if (builder.Environment.IsDevelopment())
    {
        options.EnableDetailedErrors();
        options.EnableSensitiveDataLogging();
    }
});

// Stateless and thread-safe; the decoy hash is computed once at construction.
builder.Services.AddSingleton<IPasswordHashingService, PasswordHashingService>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

builder.Services.AddControllers();
builder.Services.AddProblemDetails();

/* ---------------------------------------------------------------------------
   Authentication
   --------------------------------------------------------------------------- */
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            ValidateAudience = true,
            ValidAudience = jwtAudience,

            ValidateLifetime = true,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

            /* Default is five minutes of grace, which quietly extends every
               expiry. Access tokens here last thirty minutes; five of those
               minutes being a lie is not acceptable. */
            ClockSkew = TimeSpan.Zero,

            /* Pin the algorithm. Without this a token is accepted on the
               strength of its own "alg" header, which is how algorithm
               confusion attacks start. */
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],

            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
            NameClaimType = System.Security.Claims.ClaimTypes.NameIdentifier,
        };

        // Do not send the token back in error responses.
        options.IncludeErrorDetails = builder.Environment.IsDevelopment();
    });

/* ---------------------------------------------------------------------------
   Authorization: closed by default
   ---------------------------------------------------------------------------
   The fallback policy applies to every endpoint that does not state its own.
   So a new controller action is protected the moment it is written, and a
   public one has to say [AllowAnonymous] out loud.

   This inverts the usual failure mode. Normally, forgetting [Authorize] leaves
   an endpoint wide open and nothing complains - which is exactly how an
   unauthenticated GET /api/users ends up returning every customer's name,
   email, phone and home address. Here, forgetting the attribute makes the
   endpoint return 401 and somebody notices in the first minute.
   --------------------------------------------------------------------------- */
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build())
    .AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));

/* ---------------------------------------------------------------------------
   Rate limiting
   ---------------------------------------------------------------------------
   Without this, the login endpoint is a password-guessing oracle that answers
   as fast as the database can. The window is per client IP; the limits are in
   appsettings so they can be loosened for an office behind one address without
   a rebuild.
   --------------------------------------------------------------------------- */
var authAttempts = builder.Configuration.GetValue("RateLimit:AuthAttempts", 5);
var authWindowMinutes = builder.Configuration.GetValue("RateLimit:AuthWindowMinutes", 15);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = authAttempts,
            Window = TimeSpan.FromMinutes(authWindowMinutes),
            QueueLimit = 0,
        }));
});

/* ---------------------------------------------------------------------------
   CORS
   ---------------------------------------------------------------------------
   An explicit list from configuration. Never AllowAnyOrigin together with
   credentials - the browser refuses that combination anyway, and reaching for
   it is usually a sign the real origin was never written down.
   --------------------------------------------------------------------------- */
const string CorsPolicy = "HockeyFrontEnd";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

/* ---------------------------------------------------------------------------
   Swagger, with a box to paste a token into
   --------------------------------------------------------------------------- */
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Hockey API",
        Version = "v1",
        Description = "Lebanese Ice Hockey Federation backend.",
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token from POST /api/auth/login. No \"Bearer \" prefix needed.",
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        { new OpenApiSecuritySchemeReference("Bearer", document), new List<string>() },
    });
});

var app = builder.Build();

// ===========================================================================
// Pipeline. Order matters: each line below depends on the ones above it.
// ===========================================================================

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Hockey API v1"));
}
else
{
    /* Tells browsers to refuse plain HTTP to this host for the next year.
       Development is excluded because the header sticks in the browser and
       would then apply to every other localhost project. */
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseCors(CorsPolicy);

app.UseRateLimiter();

app.UseAuthentication();   // who are you
app.UseAuthorization();    // may you

app.MapControllers();

/* Applies any pending migration and writes the demo data, in development only.
   Never in production: there, migrations are run deliberately from the command
   line so somebody is watching when a schema changes. */
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

app.Run();
