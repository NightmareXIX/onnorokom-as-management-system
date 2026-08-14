using System.ComponentModel.DataAnnotations;
using AssignmentSystem.Api.Models;

namespace AssignmentSystem.Api.DTOs;

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password
);

public record LoginResponse(
    string Token,
    UserRole Role,
    string FullName
);

public record UserProfileResponse(
    Guid Id,
    string FullName,
    string Email,
    UserRole Role,
    Guid? ClassId
);

public record RegisterRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    [Required] Guid ClassId
);

public record RegisterResponse(Guid Id, string Email, string Message);
