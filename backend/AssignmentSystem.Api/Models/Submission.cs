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

    // Null until graded; must be 0 <= Marks <= Assignment.MaxMarks.
    public int? Marks { get; set; }
    public string? Feedback { get; set; }

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? GradedAt { get; set; }

    public Guid? GradedByTeacherId { get; set; }
    public User? GradedByTeacher { get; set; }
}
