namespace AssignmentSystem.Api.Models;

public enum UserRole
{
    Admin,
    Teacher,
    Student
}

public enum AssignmentStatus
{
    Draft,
    Published
}

public enum SubmissionStatus
{
    Submitted,
    Graded,
    ReturnedForRevision
}

public enum NotificationType
{
    SubmissionGraded,
    SubmissionReturnedForRevision,
    AssignmentPublished,
    NewSubmissionReceived,
    RegistrationPendingApproval
}
