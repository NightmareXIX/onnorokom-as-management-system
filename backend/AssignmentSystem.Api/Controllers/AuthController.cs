using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly TokenService _tokenService;
    private readonly ILogger<AuthController> _logger;
    private readonly PasswordHasher<User> _passwordHasher = new();

    public AuthController(AppDbContext context, TokenService tokenService, ILogger<AuthController> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _logger = logger;
    }

    /// <summary>Authenticates a user by email/password and issues a JWT bearer token.</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await _context.Users
            .SingleOrDefaultAsync(u => u.Email == request.Email);

        if (user is null || !user.IsActive)
        {
            _logger.LogWarning("Failed login attempt for {Email}: unknown or inactive account", request.Email);
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");
        }

        var verificationResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verificationResult == PasswordVerificationResult.Failed)
        {
            _logger.LogWarning("Failed login attempt for {Email}: wrong password", request.Email);
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");
        }

        var token = _tokenService.GenerateToken(user);

        _logger.LogInformation("User {Email} ({Role}) logged in successfully", user.Email, user.Role);

        return Ok(new LoginResponse(token, user.Role, user.FullName));
    }

    /// <summary>Returns the profile of the currently authenticated user.</summary>
    [HttpGet("me")]
    public async Task<ActionResult<UserProfileResponse>> Me()
    {
        var id = User.GetUserId();
        var user = await _context.Users.FindAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        return Ok(new UserProfileResponse(user.Id, user.FullName, user.Email, user.Role, user.ClassId));
    }
}
