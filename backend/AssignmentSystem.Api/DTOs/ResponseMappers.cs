using AssignmentSystem.Api.Models;

namespace AssignmentSystem.Api.DTOs;

internal static class AssignmentResponseMapper
{
    public static AssignmentResponse Map(Assignment a) => new(
        a.Id,
        a.Title,
        a.Description,
        a.ClassId,
        a.Class?.Name ?? string.Empty,
        a.SubjectId,
        a.Subject?.Name ?? string.Empty,
        a.TeacherId,
        a.Teacher?.FullName ?? string.Empty,
        a.Deadline,
        a.MaxMarks,
        a.Status,
        a.AllowResubmission,
        a.CreatedAt,
        a.UpdatedAt
    );
}

internal static class SubmissionResponseMapper
{
    public static SubmissionResponse Map(Submission s) => new(
        s.Id,
        s.AssignmentId,
        s.Assignment?.Title ?? string.Empty,
        s.StudentId,
        s.Student?.FullName ?? string.Empty,
        s.Content,
        s.Status,
        s.Marks,
        s.Feedback,
        s.SubmittedAt,
        s.UpdatedAt,
        s.GradedAt,
        s.GradedByTeacherId,
        s.FileName,
        s.FileSizeBytes
    );
}
