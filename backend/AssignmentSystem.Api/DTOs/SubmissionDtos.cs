using System.ComponentModel.DataAnnotations;
using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Http;

namespace AssignmentSystem.Api.DTOs;

public record CreateSubmissionRequest([Required] string Content, IFormFile? File);

public record UpdateSubmissionRequest([Required] string Content, IFormFile? File);

public record GradeSubmissionRequest(int Marks, string? Feedback);

public record UpdateSubmissionStatusRequest(SubmissionStatus Status);

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
    Guid? GradedByTeacherId,
    string? FileName,
    long? FileSizeBytes
);
