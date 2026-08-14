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
    private readonly NotificationService _notifications;
    private readonly PasswordHasher<User> _passwordHasher = new();

    public AuthController(AppDbContext context, TokenService tokenService, ILogger<AuthController> logger, NotificationService notifications)
    {
        _context = context;
        _tokenService = tokenService;
        _logger = logger;
        _notifications = notifications;
    }

    /// <summary>Authenticates a user by email/password and issues a JWT bearer token.</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await _context.Users
            .SingleOrDefaultAsync(u => u.Email == request.Email);

        if (user is null)
        {
            _logger.LogWarning("Failed login attempt for {Email}: unknown account", request.Email);
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");
        }

        if (!user.IsActive)
        {
            if (user.PendingApproval)
            {
                _logger.LogWarning("Failed login attempt for {Email}: account pending approval", request.Email);
                return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Your account is pending administrator approval. Please check back later.");
            }

            _logger.LogWarning("Failed login attempt for {Email}: inactive account", request.Email);
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

    /// <summary>Self-registers a new Student account (public). The account is created inactive
    /// and pending an Admin's approval before it can log in.</summary>
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<ActionResult<RegisterResponse>> Register(RegisterRequest request)
    {
        var emailInUse = await _context.Users.AnyAsync(u => u.Email == request.Email);
        if (emailInUse)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A user with this email already exists.");
        }

        var classExists = await _context.Classes.AnyAsync(c => c.Id == request.ClassId);
        if (!classExists)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Select a valid class.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName,
            Email = request.Email,
            Role = UserRole.Student,
            ClassId = request.ClassId,
            IsActive = false,
            PendingApproval = true,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _context.Users.Add(user);
        await _notifications.NotifyPendingApprovalAsync(user.FullName, user.Email);
        await _context.SaveChangesAsync();

        _logger.LogInformation("New self-registration pending approval: {Email}", user.Email);

        var response = new RegisterResponse(user.Id, user.Email,
            "Account created. An administrator must approve your account before you can sign in.");
        return StatusCode(StatusCodes.Status201Created, response);
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
