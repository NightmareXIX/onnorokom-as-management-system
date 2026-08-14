using System.Security.Claims;

namespace AssignmentSystem.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        if (value is null || !Guid.TryParse(value, out var id))
        {
            throw new InvalidOperationException("Authenticated principal is missing a valid user id claim.");
        }

        return id;
    }

    public static string? GetRole(this ClaimsPrincipal principal) => principal.FindFirstValue(ClaimTypes.Role);
}
