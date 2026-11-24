using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models.Validation;

/// <summary>
/// Rejects a date later than today.
///
/// This rule lives in code rather than as a database CHECK constraint on
/// purpose. PostgreSQL re-evaluates check expressions when a dump is restored,
/// so a constraint written against CURRENT_DATE is not a fixed rule - it is a
/// rule that can start failing later, and the first sign of it is a backup that
/// will not load. Anything that moves with the clock belongs here.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field, AllowMultiple = false)]
public sealed class NotInTheFutureAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) => value switch
    {
        null => true, // "not supplied" is a separate question; [Required] asks it.
        DateOnly date => date <= DateOnly.FromDateTime(DateTime.UtcNow),
        DateTime instant => instant <= DateTime.UtcNow,
        _ => false,
    };

    public override string FormatErrorMessage(string name) => $"{name} cannot be in the future.";
}
