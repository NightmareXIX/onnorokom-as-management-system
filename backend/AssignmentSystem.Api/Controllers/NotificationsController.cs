using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public NotificationsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Lists the calling user's own notifications, newest first. Any authenticated role. Supports paging and an unreadOnly filter.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<NotificationResponse>>> GetMine(int page = 1, int pageSize = 20, bool unreadOnly = false)
    {
        var userId = User.GetUserId();

        (page, pageSize) = PagingDefaults.Clamp(page, pageSize);

        var query = _context.Notifications
            .Where(n => n.RecipientUserId == userId)
            .AsQueryable();

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var totalCount = await query.CountAsync();
        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new PagedResult<NotificationResponse>(
            notifications.Select(NotificationResponseMapper.Map).ToList(), page, pageSize, totalCount));
    }

    /// <summary>Returns the calling user's unread notification count, for a lightweight polling badge. Any authenticated role.</summary>
    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountResponse>> GetUnreadCount()
    {
        var userId = User.GetUserId();
        var count = await _context.Notifications.CountAsync(n => n.RecipientUserId == userId && !n.IsRead);
        return Ok(new UnreadCountResponse(count));
    }

    /// <summary>Marks one of the calling user's own notifications as read. Any authenticated role.</summary>
    [HttpPatch("{id:guid}/read")]
    public async Task<ActionResult<NotificationResponse>> MarkAsRead(Guid id)
    {
        var userId = User.GetUserId();

        var notification = await _context.Notifications.FindAsync(id);
        if (notification is null)
        {
            return NotFound();
        }

        if (notification.RecipientUserId != userId)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "You do not own this notification.");
        }

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            await _context.SaveChangesAsync();
        }

        return Ok(NotificationResponseMapper.Map(notification));
    }

    /// <summary>Marks all of the calling user's unread notifications as read. Any authenticated role.</summary>
    [HttpPost("mark-all-read")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = User.GetUserId();

        var unread = await _context.Notifications
            .Where(n => n.RecipientUserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var notification in unread)
        {
            notification.IsRead = true;
        }

        if (unread.Count > 0)
        {
            await _context.SaveChangesAsync();
        }

        return NoContent();
    }
}
