namespace AssignmentSystem.Api.Models;

public class User
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }

    // Only set for Students.
    public Guid? ClassId { get; set; }
    public Class? Class { get; set; }

    public bool IsActive { get; set; } = true;

    // True only for a self-registered account that hasn't been approved by an Admin yet.
    // Cleared automatically the moment an Admin sets IsActive back to true.
    public bool PendingApproval { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
