using AssignmentSystem.Api.Models;

namespace AssignmentSystem.Api.DTOs;

public record NotificationResponse(
    Guid Id,
    NotificationType Type,
    string Message,
    string? ActionUrl,
    bool IsRead,
    DateTime CreatedAt
);

public record UnreadCountResponse(int Count);
