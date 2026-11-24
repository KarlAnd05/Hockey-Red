using System.ComponentModel.DataAnnotations;

namespace HockeyApi.Models.Validation;

/// <summary>
/// [Phone], except that "no phone number" is allowed.
///
/// PhoneAttribute treats null as valid but an empty string as invalid. Every
/// optional phone field in this project is a non-nullable string that defaults
/// to string.Empty rather than null, so plain [Phone] rejects the ordinary case
/// of somebody not giving a number at all.
///
/// That is not theoretical: it made POST /api/auth/register return
/// 400 "The Phone field is not a valid phone number." for anyone who signed up
/// without typing one, which is most people.
///
/// A number that IS supplied is still checked, by delegating to PhoneAttribute
/// itself. This composes rather than inherits because PhoneAttribute does not
/// leave IsValid open to override.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field, AllowMultiple = false)]
public sealed class OptionalPhoneAttribute : ValidationAttribute
{
    private static readonly PhoneAttribute Phone = new();

    public override bool IsValid(object? value) => value switch
    {
        null => true,
        string s when string.IsNullOrWhiteSpace(s) => true,
        _ => Phone.IsValid(value),
    };

    public override string FormatErrorMessage(string name) => $"{name} is not a valid phone number.";
}
