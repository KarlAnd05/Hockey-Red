using System.Security.Claims;
using HockeyApi.Data;
using HockeyApi.Dtos;
using HockeyApi.Models;
using HockeyApi.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace HockeyApi.Controllers;

/// <summary>
/// Registration, sign-in, refresh and sign-out.
///
/// This is the only controller in the project so far, and it exists to prove
/// the hashing works end to end. Everything else is schema.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly HockeyDbContext _db;
    private readonly IPasswordHashingService _passwords;
    private readonly IJwtTokenService _tokens;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        HockeyDbContext db,
        IPasswordHashingService passwords,
        IJwtTokenService tokens,
        ILogger<AuthController> logger)
    {
        _db = db;
        _passwords = passwords;
        _tokens = tokens;
        _logger = logger;
    }

    /* One message for every way a sign-in can fail. Distinguishing "no such
       account" from "wrong password" turns the endpoint into a membership
       oracle: anyone can test an address list and learn who has an account
       here, which is itself worth something to a phisher. */
    private const string SignInFailed = "Invalid email or password.";

    // =======================================================================
    // POST /api/auth/register
    // =======================================================================
    [AllowAnonymous]
    [HttpPost("register")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        // Stored lower-cased: PostgreSQL compares text case-sensitively, so
        // without this Karl@ and karl@ would be two accounts.
        var email = request.Email.Trim().ToLowerInvariant();

        /* A pre-check, for a clear error message. It is NOT what prevents
           duplicates - two simultaneous registrations would both pass it. The
           unique index does that, and the catch below turns its error into a
           409. Treating this check as the guarantee is a real bug in the
           project this one is modelled on. */
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with that email already exists." });

        var customerRoleId = await _db.Roles
            .Where(r => r.Name == nameof(UserRole.Customer))
            .Select(r => r.Id)
            .SingleAsync();

        var user = new User
        {
            Email = email,

            // The only place a password is ever turned into something stored.
            PasswordHash = _passwords.Hash(request.Password),

            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Phone = request.Phone.Trim(),

            /* Always Customer. The role is not taken from the request, and
               RegisterRequest has no field for it, so there is no way to ask
               for Admin here. Promotion is a deliberate admin action. */
            RoleId = customerRoleId,
        };

        _db.Users.Add(user);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            return Conflict(new { message = "An account with that email already exists." });
        }

        await _db.Entry(user).Reference(u => u.Role).LoadAsync();

        var response = await IssueTokensAsync(user);
        return CreatedAtAction(nameof(Me), null, response);
    }

    // =======================================================================
    // POST /api/auth/login
    // =======================================================================
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users
            .Include(u => u.Role)
            .SingleOrDefaultAsync(u => u.Email == email);

        /* Unknown email: still run a full verification, against a decoy hash.

           Skipping it would make the unknown-email case return in about a
           microsecond while a real one takes the ~100ms that 210,000 PBKDF2
           iterations cost. That difference is measurable over the network, and
           it hands out the same membership list the shared error message was
           meant to withhold. */
        if (user is null)
        {
            _passwords.Verify(_passwords.DecoyHash, request.Password);
            return Unauthorized(new { message = SignInFailed });
        }

        var check = _passwords.Verify(user.PasswordHash, request.Password);

        if (check == PasswordCheck.Failed)
            return Unauthorized(new { message = SignInFailed });

        /* The password was right, so this is a real member - but the account is
           locked. Checked AFTER verification, deliberately: checking first
           would answer "is this address registered" without a password. */
        if (!user.IsActive)
            return Unauthorized(new { message = SignInFailed });

        /* The stored hash used weaker settings than the ones in force now. This
           is the one moment the plain-text exists, so it is the only chance to
           upgrade it. */
        if (check == PasswordCheck.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwords.Hash(request.Password);
            _logger.LogInformation("Upgraded password hash for user {UserId}.", user.Id);
        }

        var response = await IssueTokensAsync(user);
        return Ok(response);
    }

    // =======================================================================
    // POST /api/auth/refresh
    // =======================================================================
    [AllowAnonymous]
    [HttpPost("refresh")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request)
    {
        var hash = TokenHasher.Hash(request.RefreshToken);

        var stored = await _db.RefreshTokens
            .Include(t => t.User)
            .ThenInclude(u => u.Role)
            .SingleOrDefaultAsync(t => t.TokenHash == hash);

        if (stored is null || stored.RevokedAt is not null || stored.ExpiresAt <= DateTime.UtcNow)
            return Unauthorized(new { message = "That refresh token is not valid." });

        if (!stored.User.IsActive)
            return Unauthorized(new { message = "That refresh token is not valid." });

        /* Rotation: the presented token is spent, and a new one is issued. A
           token used twice is therefore visibly already-revoked, which is the
           signal that one was stolen. Revoked rather than deleted, so that
           signal survives. */
        stored.RevokedAt = DateTime.UtcNow;

        var response = await IssueTokensAsync(stored.User);
        return Ok(response);
    }

    // =======================================================================
    // POST /api/auth/logout
    // =======================================================================
    /* Not rate limited. The "auth" policy exists to slow down guessing at
       the sign-in endpoints; logout and /me already require a valid token, so
       there is nothing to guess. Left on the controller they shared the login
       budget, which meant an app calling /me on each page load locked its own
       user out of signing in after five page loads. */
    [DisableRateLimiting]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout()
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        // Every device, not just this one. That is what people expect from it.
        await _db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));

        return NoContent();
    }

    // =======================================================================
    // GET /api/auth/me
    // =======================================================================
    /// <summary>
    /// The signed-in user. No [Authorize] attribute is needed - the fallback
    /// policy in Program.cs already requires one, which is the point of having
    /// it.
    /// </summary>
    [DisableRateLimiting]
    [HttpGet("me")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserResponse>> Me()
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        /* Read the id from the token, never from a route or query parameter.
           Taking it from the request is what lets one customer read another's
           record by changing a number in the URL. */
        var user = await _db.Users
            .Include(u => u.Role)
            .SingleOrDefaultAsync(u => u.Id == userId);

        if (user is null) return Unauthorized();

        return Ok(ToResponse(user));
    }

    // =======================================================================
    // Helpers
    // =======================================================================

    /* PostgreSQL 23505 is unique_violation. Catching the specific code rather
       than every DbUpdateException means a genuinely broken write still
       surfaces as a 500 instead of being reported as a duplicate email. */
    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" };

    private int? CurrentUserId() =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private async Task<AuthResponse> IssueTokensAsync(User user)
    {
        var (accessToken, accessExpires) = _tokens.CreateAccessToken(user);

        // Generated here, hashed before it is stored, and returned exactly once.
        var refreshToken = TokenHasher.NewToken();
        var refreshExpires = DateTime.UtcNow.Add(_tokens.RefreshTokenLifetime);

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = TokenHasher.Hash(refreshToken),
            ExpiresAt = refreshExpires,
        });

        await _db.SaveChangesAsync();

        return new AuthResponse
        {
            AccessToken = accessToken,
            AccessTokenExpiresAt = accessExpires,
            RefreshToken = refreshToken,
            RefreshTokenExpiresAt = refreshExpires,
            User = ToResponse(user),
        };
    }

    private static UserResponse ToResponse(User user) => new()
    {
        Id = user.Id,
        Email = user.Email,
        FirstName = user.FirstName,
        LastName = user.LastName,
        Role = user.Role?.Name ?? nameof(UserRole.Customer),
    };
}
