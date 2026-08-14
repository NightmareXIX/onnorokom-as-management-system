namespace AssignmentSystem.Api.Models;

public class Submission
{
    public Guid Id { get; set; }

    public Guid AssignmentId { get; set; }
    public Assignment? Assignment { get; set; }

    public Guid StudentId { get; set; }
    public User? Student { get; set; }

    public string Content { get; set; } = string.Empty;
    public SubmissionStatus Status { get; set; }

    // Optional attachment supplementing Content. StoredFileName is always a generated
    // Guid + validated extension, never derived from the client-supplied FileName, so it's
    // safe to use directly as an on-disk path segment.
    public string? FileName { get; set; }
    public string? StoredFileName { get; set; }
    public string? FileContentType { get; set; }
    public long? FileSizeBytes { get; set; }

    // Null until graded; must be 0 <= Marks <= Assignment.MaxMarks.
    public int? Marks { get; set; }
    public string? Feedback { get; set; }

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? GradedAt { get; set; }

    public Guid? GradedByTeacherId { get; set; }
    public User? GradedByTeacher { get; set; }
}
