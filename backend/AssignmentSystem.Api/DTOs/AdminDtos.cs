using System.ComponentModel.DataAnnotations;
using AssignmentSystem.Api.Models;

namespace AssignmentSystem.Api.DTOs;

public record CreateUserRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    UserRole Role,
    Guid? ClassId
);

public record UpdateUserRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    UserRole Role,
    Guid? ClassId,
    bool IsActive
);

public record UserResponse(
    Guid Id,
    string FullName,
    string Email,
    UserRole Role,
    Guid? ClassId,
    string? ClassName,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateClassRequest([Required] string Name, string? Description);

public record UpdateClassRequest([Required] string Name, string? Description);

public record CreateSubjectRequest([Required] string Name, string? Code);

public record UpdateSubjectRequest([Required] string Name, string? Code);

public record CreateTeacherAssignmentRequest(Guid TeacherId, Guid SubjectId, Guid ClassId);

public record TeacherAssignmentResponse(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    Guid SubjectId,
    string SubjectName,
    Guid ClassId,
    string ClassName
);
