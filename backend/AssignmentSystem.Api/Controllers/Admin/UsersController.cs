using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PasswordHasher<User> _passwordHasher = new();

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Lists all users, including inactive ones (Admin only).</summary>
    [HttpGet]
    public async Task<ActionResult<List<UserResponse>>> GetAll()
    {
        var users = await _context.Users
            .Include(u => u.Class)
            .OrderBy(u => u.FullName)
            .ToListAsync();

        return Ok(users.Select(MapToResponse).ToList());
    }

    /// <summary>Creates a new user account (Admin only). Students require a valid ClassId.</summary>
    [HttpPost]
    public async Task<ActionResult<UserResponse>> Create(CreateUserRequest request)
    {
        var emailInUse = await _context.Users.AnyAsync(u => u.Email == request.Email);
        if (emailInUse)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A user with this email already exists.");
        }

        if (request.Role == UserRole.Student)
        {
            var classExists = request.ClassId is not null && await _context.Classes.AnyAsync(c => c.Id == request.ClassId);
            if (!classExists)
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A valid ClassId is required for Student accounts.");
            }
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName,
            Email = request.Email,
            Role = request.Role,
            ClassId = request.Role == UserRole.Student ? request.ClassId : null,
            IsActive = true,
            PendingApproval = false,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var response = await LoadResponseAsync(user.Id);
        return CreatedAtAction(nameof(GetAll), response);
    }

    /// <summary>Updates a user's profile, role, class, and active status (Admin only). Also used to reactivate a deactivated user.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserResponse>> Update(Guid id, UpdateUserRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        var emailInUse = await _context.Users.AnyAsync(u => u.Id != id && u.Email == request.Email);
        if (emailInUse)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A user with this email already exists.");
        }

        if (request.Role == UserRole.Student)
        {
            var classExists = request.ClassId is not null && await _context.Classes.AnyAsync(c => c.Id == request.ClassId);
            if (!classExists)
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A valid ClassId is required for Student accounts.");
            }
        }

        user.FullName = request.FullName;
        user.Email = request.Email;
        user.Role = request.Role;
        user.ClassId = request.Role == UserRole.Student ? request.ClassId : null;
        user.IsActive = request.IsActive;
        if (request.IsActive)
        {
            // Activating a self-registered account is how an Admin approves it.
            user.PendingApproval = false;
        }

        await _context.SaveChangesAsync();

        return Ok(await LoadResponseAsync(user.Id));
    }

    /// <summary>Deactivates a user (Admin only). Soft-delete only — users with history are never hard-deleted.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        // Soft-delete only: users with submission/assignment history are never hard-deleted.
        user.IsActive = false;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task<UserResponse> LoadResponseAsync(Guid id)
    {
        var user = await _context.Users.Include(u => u.Class).FirstAsync(u => u.Id == id);
        return MapToResponse(user);
    }

    private static UserResponse MapToResponse(User u) => new(
        u.Id,
        u.FullName,
        u.Email,
        u.Role,
        u.ClassId,
        u.Class?.Name,
        u.IsActive,
        u.PendingApproval,
        u.CreatedAt
    );
}
