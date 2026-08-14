using System.ComponentModel.DataAnnotations;
using AssignmentSystem.Api.Models;

namespace AssignmentSystem.Api.DTOs;

public record CreateAssignmentRequest(
    [Required] string Title,
    [Required] string Description,
    Guid ClassId,
    Guid SubjectId,
    DateTime Deadline,
    [Range(1, int.MaxValue)] int MaxMarks,
    bool AllowResubmission = false,
    AssignmentStatus Status = AssignmentStatus.Draft
);

public record UpdateAssignmentRequest(
    [Required] string Title,
    [Required] string Description,
    Guid ClassId,
    Guid SubjectId,
    DateTime Deadline,
    [Range(1, int.MaxValue)] int MaxMarks,
    bool AllowResubmission
);

public record AssignmentResponse(
    Guid Id,
    string Title,
    string Description,
    Guid ClassId,
    string ClassName,
    Guid SubjectId,
    string SubjectName,
    Guid TeacherId,
    string TeacherName,
    DateTime Deadline,
    int MaxMarks,
    AssignmentStatus Status,
    bool AllowResubmission,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
