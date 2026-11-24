using System.ComponentModel.DataAnnotations;
using HockeyApi.Models.Validation;

namespace HockeyApi.Models;

/// <summary>
/// A membership registration - the federation's player form.
///
/// THIS IS THE MOST SENSITIVE RECORD IN THE SYSTEM. It holds passport-form
/// names, a date of birth, a place of birth and both parents' citizenships,
/// submitted in part by or for minors. The parental citizenship fields exist
/// because IIHF eligibility turns on them.
///
/// Consequences, enforced elsewhere but stated here so nobody has to go
/// looking:
///   - every read path is admin-only; there is no public endpoint that returns
///     a Registration, not even a filtered one;
///   - it is never serialised directly - responses go through a DTO that
///     carries a name and a tier and nothing else;
///   - it is never written to a log.
///
/// Payment state is tracked separately from the submission: a registration is a
/// real record whether or not the fee has been paid yet.
/// </summary>
public class Registration
{
    public int Id { get; set; }

    public RegistrationTier Tier { get; set; }

    public int AmountCents { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "cad";

    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Unpaid;

    [MaxLength(255)]
    public string? StripeSessionId { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; set; } = null!;

    [OptionalPhone]
    [MaxLength(40)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(80)]
    public string FirstName { get; set; } = string.Empty;

    [MaxLength(80)]
    public string LastName { get; set; } = string.Empty;

    [MaxLength(80)]
    public string MiddleName { get; set; } = string.Empty;

    /// <summary>A date, not a timestamp - and nullable, because the form may be
    /// submitted before this is known.</summary>
    [NotInTheFuture]
    public DateOnly? DateOfBirth { get; set; }

    [MaxLength(40)]
    public string Position { get; set; } = string.Empty;

    /// <summary>Left or right.</summary>
    [MaxLength(10)]
    public string Shoots { get; set; } = string.Empty;

    [Range(0, 300)]
    public int? HeightCm { get; set; }

    [Range(0, 400)]
    public int? WeightKg { get; set; }

    [MaxLength(120)]
    public string PlaceOfBirth { get; set; } = string.Empty;

    [MaxLength(120)]
    public string CountryOfBirth { get; set; } = string.Empty;

    [MaxLength(120)]
    public string CityOfResidence { get; set; } = string.Empty;

    [MaxLength(120)]
    public string Citizenship { get; set; } = string.Empty;

    [MaxLength(120)]
    public string CitizenshipSecond { get; set; } = string.Empty;

    [MaxLength(120)]
    public string CitizenshipFather { get; set; } = string.Empty;

    [MaxLength(120)]
    public string CitizenshipMother { get; set; } = string.Empty;

    [MaxLength(200)]
    public string HighestLevelPlayed { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Message { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}
