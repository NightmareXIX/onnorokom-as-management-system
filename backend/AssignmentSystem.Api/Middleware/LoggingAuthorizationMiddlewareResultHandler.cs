using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace AssignmentSystem.Api.Middleware;

/// <summary>
/// Wraps the default authorization result handler to log every role-based rejection
/// (a `[Authorize(Roles=...)]` failure that never reaches a controller action) before
/// the standard 401/403 response is written.
/// </summary>
public class LoggingAuthorizationMiddlewareResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _defaultHandler = new();
    private readonly ILogger<LoggingAuthorizationMiddlewareResultHandler> _logger;

    public LoggingAuthorizationMiddlewareResultHandler(ILogger<LoggingAuthorizationMiddlewareResultHandler> logger)
    {
        _logger = logger;
    }

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Forbidden)
        {
            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
            var role = context.User.FindFirstValue(ClaimTypes.Role) ?? "none";
            _logger.LogWarning(
                "Authorization rejected (403): user {UserId} (role {Role}) -> {Method} {Path}",
                userId, role, context.Request.Method, context.Request.Path);
        }
        else if (authorizeResult.Challenged)
        {
            _logger.LogWarning(
                "Authentication challenge (401): {Method} {Path}",
                context.Request.Method, context.Request.Path);
        }

        await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
    }
}
