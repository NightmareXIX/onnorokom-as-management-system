using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

public class ResubmissionRulesTests
{
    [Fact]
    public async Task Update_Rejects_WhenResubmissionNotAllowed()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, allowResubmission: false);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.Update(submission.Id, new UpdateSubmissionRequest("edited answer", null));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Update_Rejects_AfterDeadline_EvenWhenResubmissionAllowed()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(
            teacher.Id, cls.Id, subject.Id, deadline: DateTime.UtcNow.AddDays(-1), allowResubmission: true);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.Update(submission.Id, new UpdateSubmissionRequest("too late edit", null));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Update_Rejects_WhenNotTheOwningStudent()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var owner = TestEntities.NewStudent(cls.Id, "Owner");
        var otherStudent = TestEntities.NewStudent(cls.Id, "Someone Else");
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, allowResubmission: true);
        var submission = TestEntities.NewSubmission(assignment.Id, owner.Id);

        db.AddRange(cls, subject, teacher, owner, otherStudent, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(otherStudent.Id, UserRole.Student);

        var result = await controller.Update(submission.Id, new UpdateSubmissionRequest("not mine to edit", null));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Update_Succeeds_AndResetsGrade_WhenAllowedAndBeforeDeadline()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(
            teacher.Id, cls.Id, subject.Id, deadline: DateTime.UtcNow.AddDays(3), allowResubmission: true);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id, status: SubmissionStatus.Graded);
        submission.Marks = 80;
        submission.Feedback = "Well done";
        submission.GradedAt = DateTime.UtcNow;
        submission.GradedByTeacherId = teacher.Id;

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.Update(submission.Id, new UpdateSubmissionRequest("revised answer", null));

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var updated = okResult.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;
        updated.Content.Should().Be("revised answer");
        updated.Status.Should().Be(SubmissionStatus.Submitted);
        updated.Marks.Should().BeNull();
        updated.Feedback.Should().BeNull();
        updated.GradedAt.Should().BeNull();
        updated.GradedByTeacherId.Should().BeNull();
    }
}
