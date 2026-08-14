using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

public class NotificationCreationTests
{
    private static TokenService CreateTokenService()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "unit-test-only-secret-key-at-least-32-chars-long",
                ["Jwt:Issuer"] = "AssignmentSystemApi.Tests",
                ["Jwt:Audience"] = "AssignmentSystemApi.Tests",
                ["Jwt:ExpiryMinutes"] = "60"
            })
            .Build();
        return new TokenService(configuration);
    }

    [Fact]
    public async Task Grade_CreatesNotificationForStudent_WithCorrectMessage()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, maxMarks: 100, title: "Algebra Homework");
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        await controller.Grade(submission.Id, new GradeSubmissionRequest(85, "good job"));

        var notification = await db.Notifications.SingleAsync(n => n.RecipientUserId == student.Id);
        notification.Type.Should().Be(NotificationType.SubmissionGraded);
        notification.SubmissionId.Should().Be(submission.Id);
        notification.AssignmentId.Should().BeNull();
        notification.Message.Should().Contain("Algebra Homework").And.Contain("85/100");
        notification.IsRead.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateStatus_ReturnedForRevision_CreatesNotificationForStudent()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id, status: SubmissionStatus.Graded);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        await controller.UpdateStatus(submission.Id, new UpdateSubmissionStatusRequest(SubmissionStatus.ReturnedForRevision));

        var notification = await db.Notifications.SingleAsync(n => n.RecipientUserId == student.Id);
        notification.Type.Should().Be(NotificationType.SubmissionReturnedForRevision);
        notification.SubmissionId.Should().Be(submission.Id);
    }

    [Fact]
    public async Task UpdateStatus_NotReturnedForRevision_CreatesNoNotification()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id, status: SubmissionStatus.Submitted);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        await controller.UpdateStatus(submission.Id, new UpdateSubmissionStatusRequest(SubmissionStatus.Submitted));

        (await db.Notifications.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Create_NotifiesTeacher_OfNewSubmission()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id, name: "Jane Doe");
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "Algebra Homework");

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        await controller.Create(assignment.Id, new CreateSubmissionRequest("my answer", null));

        var notification = await db.Notifications.SingleAsync(n => n.RecipientUserId == teacher.Id);
        notification.Type.Should().Be(NotificationType.NewSubmissionReceived);
        notification.Message.Should().Contain("Jane Doe").And.Contain("Algebra Homework");
    }

    [Fact]
    public async Task Update_Resubmission_NotifiesTeacherAgain()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, allowResubmission: true, deadline: DateTime.UtcNow.AddDays(3));
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id, status: SubmissionStatus.Graded);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        await controller.Update(submission.Id, new UpdateSubmissionRequest("revised answer", null));

        var teacherNotifications = await db.Notifications
            .Where(n => n.RecipientUserId == teacher.Id && n.Type == NotificationType.NewSubmissionReceived)
            .ToListAsync();
        teacherNotifications.Should().HaveCount(1);
    }

    [Fact]
    public async Task Publish_NotifiesOnlyActiveStudentsInThatClass()
    {
        await using var db = TestDb.CreateContext();
        var targetClass = TestEntities.NewClass("Target Class");
        var otherClass = TestEntities.NewClass("Other Class");
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var studentInClass = TestEntities.NewStudent(targetClass.Id, name: "In Class");
        var inactiveStudentInClass = TestEntities.NewStudent(targetClass.Id, name: "Inactive In Class");
        inactiveStudentInClass.IsActive = false;
        var studentInOtherClass = TestEntities.NewStudent(otherClass.Id, name: "Other Class Student");
        var assignment = TestEntities.NewAssignment(teacher.Id, targetClass.Id, subject.Id, status: AssignmentStatus.Draft, title: "New Homework");

        db.AddRange(targetClass, otherClass, subject, teacher, studentInClass, inactiveStudentInClass, studentInOtherClass, assignment);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService(), new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        await controller.Publish(assignment.Id);

        var notifications = await db.Notifications.ToListAsync();
        notifications.Should().HaveCount(1);
        notifications[0].RecipientUserId.Should().Be(studentInClass.Id);
        notifications[0].Type.Should().Be(NotificationType.AssignmentPublished);
        notifications[0].AssignmentId.Should().Be(assignment.Id);
    }

    [Fact]
    public async Task Register_NotifiesOnlyActiveAdmins()
    {
        await using var db = TestDb.CreateContext();
        var studentClass = TestEntities.NewClass();
        var activeAdmin = TestEntities.NewAdmin("Active Admin");
        var inactiveAdmin = TestEntities.NewAdmin("Inactive Admin");
        inactiveAdmin.IsActive = false;
        var teacher = TestEntities.NewTeacher();

        db.AddRange(studentClass, activeAdmin, inactiveAdmin, teacher);
        await db.SaveChangesAsync();

        var controller = new AuthController(db, CreateTokenService(), NullLogger<AuthController>.Instance, new NotificationService(db));
        controller.SetAnonymousHttpContext();

        await controller.Register(new RegisterRequest("New Student", "new-student@test.local", "Passw0rd", studentClass.Id));

        var notifications = await db.Notifications.ToListAsync();
        notifications.Should().HaveCount(1);
        notifications[0].RecipientUserId.Should().Be(activeAdmin.Id);
        notifications[0].Type.Should().Be(NotificationType.RegistrationPendingApproval);
        notifications[0].Message.Should().Contain("New Student").And.Contain("new-student@test.local");
    }
}
