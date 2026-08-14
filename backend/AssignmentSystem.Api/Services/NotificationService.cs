using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Services;

// Only queues Notification rows via _context.Notifications.Add(...) — it never calls
// SaveChangesAsync itself, so the write rides along in whichever SaveChangesAsync the calling
// controller action already makes (atomic with the state change that triggered it).
public class NotificationService
{
    private readonly AppDbContext _context;

    public NotificationService(AppDbContext context)
    {
        _context = context;
    }

    public void NotifySubmissionGraded(Guid studentId, Guid submissionId, string assignmentTitle, int marks, int maxMarks)
    {
        Add(studentId, NotificationType.SubmissionGraded,
            message: $"Your submission for \"{assignmentTitle}\" was graded: {marks}/{maxMarks}.",
            actionUrl: "/student/submissions",
            submissionId: submissionId);
    }

    public void NotifySubmissionReturnedForRevision(Guid studentId, Guid submissionId, Guid assignmentId, string assignmentTitle)
    {
        Add(studentId, NotificationType.SubmissionReturnedForRevision,
            message: $"Your submission for \"{assignmentTitle}\" was returned for revision.",
            actionUrl: $"/student/assignments/{assignmentId}",
            submissionId: submissionId);
    }

    public void NotifyNewSubmission(Guid teacherId, Guid submissionId, Guid assignmentId, string assignmentTitle, string studentName)
    {
        Add(teacherId, NotificationType.NewSubmissionReceived,
            message: $"{studentName} submitted \"{assignmentTitle}\".",
            actionUrl: $"/teacher/assignments/{assignmentId}",
            submissionId: submissionId);
    }

    public async Task NotifyAssignmentPublishedAsync(Guid classId, Guid assignmentId, string assignmentTitle)
    {
        var studentIds = await _context.Users
            .Where(u => u.ClassId == classId && u.Role == UserRole.Student && u.IsActive)
            .Select(u => u.Id)
            .ToListAsync();

        foreach (var studentId in studentIds)
        {
            Add(studentId, NotificationType.AssignmentPublished,
                message: $"New assignment published: \"{assignmentTitle}\".",
                actionUrl: $"/student/assignments/{assignmentId}",
                assignmentId: assignmentId);
        }
    }

    public async Task NotifyPendingApprovalAsync(string fullName, string email)
    {
        var adminIds = await _context.Users
            .Where(u => u.Role == UserRole.Admin && u.IsActive)
            .Select(u => u.Id)
            .ToListAsync();

        foreach (var adminId in adminIds)
        {
            Add(adminId, NotificationType.RegistrationPendingApproval,
                message: $"New student registration pending approval: {fullName} ({email}).",
                actionUrl: "/admin");
        }
    }

    private void Add(
        Guid recipientUserId, NotificationType type, string message, string? actionUrl,
        Guid? assignmentId = null, Guid? submissionId = null)
    {
        _context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = recipientUserId,
            Type = type,
            Message = message,
            ActionUrl = actionUrl,
            AssignmentId = assignmentId,
            SubmissionId = submissionId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
    }
}
