namespace HockeyApi.Models;

/* Every one of these replaces a CHECK (x IN (...)) constraint in the federation's
   existing SQLite schema. Modelling them as enums rather than strings means a
   typo is a compile error instead of a row that silently fails a constraint at
   run time - or worse, a column that quietly accepts anything because someone
   forgot the CHECK.

   They are stored as text, not as integers (see HockeyDbContext). An integer
   column is unreadable in psql and renumbers itself the moment somebody inserts
   a value in the middle of the enum; text survives both.

   Where two enums look like near-duplicates (TeamProgram/RosterProgram,
   PlayerPosition/RosterPosition) it is because the source schema really does
   constrain the two columns differently. Merging them would quietly widen a
   constraint, which is the opposite of the point. */

public enum UserRole
{
    Customer,
    Admin,
}

public enum DiscountType
{
    Percent,
    Fixed,
}

public enum OrderStatus
{
    Pending,
    Paid,
    Fulfilled,
    Cancelled,
    Refunded,
}

/// <summary>Which membership the applicant is paying for.</summary>
public enum RegistrationTier
{
    Board,
    Player,
    Supporter,
}

public enum PaymentStatus
{
    Unpaid,
    Pending,
    Paid,
}

public enum DonationKind
{
    OneTime,
    Monthly,
}

public enum DonationStatus
{
    Pending,
    Paid,
    Active,
    PastDue,
    Canceled,
    Failed,
}

public enum DonationPaymentStatus
{
    Paid,
    Failed,
}

public enum ChatStatus
{
    Open,
    Closed,
    Blocked,
}

public enum ChatSender
{
    Visitor,
    Admin,
}

public enum GameStatus
{
    Draft,
    Final,
    Cancelled,
}

public enum HomeAway
{
    Home,
    Away,
    Neutral,
}

/// <summary>A player's part in one game, as the game sheet records it.</summary>
public enum GameSheetRole
{
    Player,
    Captain,
    Alternate,
    StartingGoaltender,
    Staff,
}

/// <summary>
/// A squad member's position. Includes Staff, because a team page lists coaches
/// and managers alongside the players.
/// </summary>
public enum PlayerPosition
{
    Forward,
    Defence,
    Goaltender,
    Staff,
}

/// <summary>
/// Positions on the published roster table. Narrower than
/// <see cref="PlayerPosition"/> on purpose: the roster lists people who dress
/// for a game, so there is no Staff.
/// </summary>
public enum RosterPosition
{
    Forward,
    Defence,
    Goaltender,
}

/// <summary>The federation's four programmes, as used on the Teams pages.</summary>
public enum TeamProgram
{
    Mens,
    Womens,
    Youth,
    Panthers,
}

/// <summary>
/// Narrower than <see cref="TeamProgram"/>: only the men's and women's
/// programmes publish a roster, which is what the source schema constrains.
/// </summary>
public enum RosterProgram
{
    Mens,
    Womens,
}

/// <summary>Within a programme, the senior squad or the one behind it.</summary>
public enum SquadLevel
{
    National,
    NextGen,
}

public enum SponsorTier
{
    Platinum,
    Gold,
    Silver,
    Bronze,
    Partner,
}

public enum EmailStatus
{
    Sent,
    Logged,
    Failed,
}
