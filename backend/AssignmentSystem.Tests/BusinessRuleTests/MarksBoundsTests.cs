using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

public class MarksBoundsTests
{
    [Fact]
    public async Task Grade_Rejects_WhenMarksExceedMaxMarks()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, maxMarks: 100);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.Grade(submission.Id, new GradeSubmissionRequest(150, "too high"));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Grade_Rejects_WhenMarksNegative()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, maxMarks: 100);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.Grade(submission.Id, new GradeSubmissionRequest(-5, "negative"));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Grade_Succeeds_WithinBounds()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, maxMarks: 100);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.Grade(submission.Id, new GradeSubmissionRequest(85, "good job"));

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var updated = okResult.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;
        updated.Marks.Should().Be(85);
        updated.Status.Should().Be(SubmissionStatus.Graded);
    }
}
