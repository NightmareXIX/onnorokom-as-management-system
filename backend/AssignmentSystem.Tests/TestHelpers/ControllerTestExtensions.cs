using System.Security.Claims;
using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace AssignmentSystem.Tests.TestHelpers;

public static class ControllerTestExtensions
{
    // ControllerBase.Problem()/ValidationProblem() resolve ProblemDetailsFactory from
    // HttpContext.RequestServices, so a bare DefaultHttpContext needs a minimal MVC-core
    // container behind it — not just a ClaimsPrincipal — or those calls throw.
    private static readonly IServiceProvider RequestServices = new ServiceCollection()
        .AddLogging()
        .AddMvcCore()
        .Services
        .BuildServiceProvider();

    /// <summary>Attaches a fake authenticated ClaimsPrincipal (userId + role) to the controller,
    /// mirroring what the real JWT bearer middleware would populate from a token's claims.</summary>
    public static void SetUser(this ControllerBase controller, Guid userId, UserRole role)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role.ToString())
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = principal,
                RequestServices = RequestServices
            }
        };
    }

    /// <summary>For controllers/actions that don't need a signed-in user (e.g. login) but whose
    /// failure paths still call Problem(), which needs RequestServices to be wired up.</summary>
    public static void SetAnonymousHttpContext(this ControllerBase controller)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { RequestServices = RequestServices }
        };
    }
}
