using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Tests.AuthorizationTests;

public class NotificationOwnershipTests
{
    [Fact]
    public async Task MarkAsRead_Rejects_WhenNotOwner()
    {
        await using var db = TestDb.CreateContext();
        var owner = TestEntities.NewStudent(Guid.NewGuid());
        var other = TestEntities.NewStudent(Guid.NewGuid());
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = owner.Id,
            Type = NotificationType.SubmissionGraded,
            Message = "Test notification",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        db.AddRange(owner, other, notification);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        controller.SetUser(other.Id, UserRole.Student);

        var result = await controller.MarkAsRead(notification.Id);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);

        var stillUnread = await db.Notifications.FindAsync(notification.Id);
        stillUnread!.IsRead.Should().BeFalse();
    }

    [Fact]
    public async Task GetMine_OnlyReturnsCallersOwnNotifications()
    {
        await using var db = TestDb.CreateContext();
        var caller = TestEntities.NewStudent(Guid.NewGuid());
        var other = TestEntities.NewStudent(Guid.NewGuid());
        var mine = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = caller.Id,
            Type = NotificationType.SubmissionGraded,
            Message = "Mine",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };
        var notMine = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = other.Id,
            Type = NotificationType.SubmissionGraded,
            Message = "Not mine",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        db.AddRange(caller, other, mine, notMine);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        controller.SetUser(caller.Id, UserRole.Student);

        var result = await controller.GetMine();

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var page = okResult.Value.Should().BeAssignableTo<AssignmentSystem.Api.DTOs.PagedResult<AssignmentSystem.Api.DTOs.NotificationResponse>>().Subject;
        page.Items.Should().ContainSingle(n => n.Id == mine.Id);
        page.Items.Should().NotContain(n => n.Id == notMine.Id);
    }

    [Fact]
    public async Task MarkAllAsRead_OnlyAffectsCallersOwnNotifications()
    {
        await using var db = TestDb.CreateContext();
        var caller = TestEntities.NewStudent(Guid.NewGuid());
        var other = TestEntities.NewStudent(Guid.NewGuid());
        var mine = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = caller.Id,
            Type = NotificationType.SubmissionGraded,
            Message = "Mine",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };
        var notMine = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = other.Id,
            Type = NotificationType.SubmissionGraded,
            Message = "Not mine",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        db.AddRange(caller, other, mine, notMine);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        controller.SetUser(caller.Id, UserRole.Student);

        await controller.MarkAllAsRead();

        (await db.Notifications.FindAsync(mine.Id))!.IsRead.Should().BeTrue();
        (await db.Notifications.FindAsync(notMine.Id))!.IsRead.Should().BeFalse();
    }
}
