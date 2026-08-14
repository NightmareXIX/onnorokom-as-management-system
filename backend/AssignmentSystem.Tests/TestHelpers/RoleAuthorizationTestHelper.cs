using System.Reflection;
using System.Security.Claims;
using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace AssignmentSystem.Tests.TestHelpers;

/// <summary>
/// Evaluates a controller action's real [Authorize(Roles = "...")] attribute (method-level and/or
/// controller-level) against a fake ClaimsPrincipal, using the same IAuthorizationService the JWT
/// bearer pipeline uses at request time — without needing a running host. This ties each test
/// directly to the actual declared attribute, so removing/weakening it fails the test.
/// </summary>
public static class RoleAuthorizationTestHelper
{
    public static ClaimsPrincipal PrincipalFor(UserRole role, Guid? userId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, (userId ?? Guid.NewGuid()).ToString()),
            new(ClaimTypes.Role, role.ToString())
        };
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    public static ClaimsPrincipal Anonymous() => new(new ClaimsIdentity());

    public static async Task<bool> IsAuthorizedAsync(MethodInfo action, ClaimsPrincipal user)
    {
        var authorizeAttributes = action.GetCustomAttributes<AuthorizeAttribute>(inherit: true)
            .Concat(action.DeclaringType!.GetCustomAttributes<AuthorizeAttribute>(inherit: true))
            .ToList();

        var policyBuilder = new AuthorizationPolicyBuilder().RequireAuthenticatedUser();
        foreach (var roles in authorizeAttributes
                     .Where(a => !string.IsNullOrWhiteSpace(a.Roles))
                     .Select(a => a.Roles!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
        {
            policyBuilder.RequireRole(roles);
        }
        var policy = policyBuilder.Build();

        var services = new ServiceCollection().AddLogging().AddAuthorizationCore().BuildServiceProvider();
        var authService = services.GetRequiredService<IAuthorizationService>();

        var result = await authService.AuthorizeAsync(user, resource: null, policy);
        return result.Succeeded;
    }
}
