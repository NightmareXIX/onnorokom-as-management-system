using AssignmentSystem.Api.Models;

namespace AssignmentSystem.Tests.TestHelpers;

/// <summary>Builders for entities with sensible defaults, to keep test arrange-blocks short.</summary>
public static class TestEntities
{
    public static Class NewClass(string name = "Class 10 - Section A") => new()
    {
        Id = Guid.NewGuid(),
        Name = name
    };

    public static Subject NewSubject(string name = "Mathematics") => new()
    {
        Id = Guid.NewGuid(),
        Name = name
    };

    public static User NewTeacher(string name = "Test Teacher") => new()
    {
        Id = Guid.NewGuid(),
        FullName = name,
        Email = $"{Guid.NewGuid()}@test.local",
        PasswordHash = "not-a-real-hash",
        Role = UserRole.Teacher,
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    public static User NewStudent(Guid classId, string name = "Test Student") => new()
    {
        Id = Guid.NewGuid(),
        FullName = name,
        Email = $"{Guid.NewGuid()}@test.local",
        PasswordHash = "not-a-real-hash",
        Role = UserRole.Student,
        ClassId = classId,
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    public static User NewAdmin(string name = "Test Admin") => new()
    {
        Id = Guid.NewGuid(),
        FullName = name,
        Email = $"{Guid.NewGuid()}@test.local",
        PasswordHash = "not-a-real-hash",
        Role = UserRole.Admin,
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    public static Assignment NewAssignment(
        Guid teacherId,
        Guid classId,
        Guid subjectId,
        DateTime? deadline = null,
        int maxMarks = 100,
        bool allowResubmission = false,
        AssignmentStatus status = AssignmentStatus.Published,
        string title = "Test Assignment",
        DateTime? createdAt = null) => new()
    {
        Id = Guid.NewGuid(),
        Title = title,
        Description = "Test assignment description",
        TeacherId = teacherId,
        ClassId = classId,
        SubjectId = subjectId,
        Deadline = deadline ?? DateTime.UtcNow.AddDays(3),
        MaxMarks = maxMarks,
        AllowResubmission = allowResubmission,
        Status = status,
        CreatedAt = createdAt ?? DateTime.UtcNow
    };

    public static Submission NewSubmission(
        Guid assignmentId,
        Guid studentId,
        string content = "Test answer",
        SubmissionStatus status = SubmissionStatus.Submitted,
        DateTime? submittedAt = null,
        string? fileName = null,
        string? storedFileName = null,
        long? fileSizeBytes = null) => new()
    {
        Id = Guid.NewGuid(),
        AssignmentId = assignmentId,
        StudentId = studentId,
        Content = content,
        Status = status,
        SubmittedAt = submittedAt ?? DateTime.UtcNow,
        FileName = fileName,
        StoredFileName = storedFileName,
        FileSizeBytes = fileSizeBytes
    };
}
