using System.ComponentModel.DataAnnotations;
using AssignmentSystem.Api.Models;

namespace AssignmentSystem.Api.DTOs;

public record CreateSubmissionRequest([Required] string Content);

public record GradeSubmissionRequest(int Marks, string? Feedback);

public record SubmissionResponse(
    Guid Id,
    Guid AssignmentId,
    string AssignmentTitle,
    Guid StudentId,
    string StudentName,
    string Content,
    SubmissionStatus Status,
    int? Marks,
    string? Feedback,
    DateTime SubmittedAt,
    DateTime? UpdatedAt,
    DateTime? GradedAt,
    Guid? GradedByTeacherId
);
