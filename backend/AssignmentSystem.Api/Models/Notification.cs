namespace AssignmentSystem.Api.Models;

public class Notification
{
    public Guid Id { get; set; }

    public Guid RecipientUserId { get; set; }
    public User? RecipientUser { get; set; }

    public NotificationType Type { get; set; }

    // Fully rendered at creation time (e.g. includes the assignment title/marks) so reads
    // never need to join back to Assignment/Submission just to display the list.
    public string Message { get; set; } = string.Empty;

    // Frontend route to navigate to when the notification is clicked.
    public string? ActionUrl { get; set; }

    // At most one of AssignmentId/SubmissionId is ever set per row (never both) — see
    // AppDbContext's OnModelCreating for why (avoids a second cascade-delete path that
    // would converge with Assignment -> Submission -> Notification).
    public Guid? AssignmentId { get; set; }
    public Assignment? Assignment { get; set; }

    public Guid? SubmissionId { get; set; }
    public Submission? Submission { get; set; }

    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
