using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.AuthorizationTests;

public class OwnershipTests
{
    [Fact]
    public async Task Grade_Rejects_WhenTeacherDoesNotOwnAssignment()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var owningTeacher = TestEntities.NewTeacher("Owning Teacher");
        var otherTeacher = TestEntities.NewTeacher("Other Teacher");
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(owningTeacher.Id, cls.Id, subject.Id);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, owningTeacher, otherTeacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(otherTeacher.Id, UserRole.Teacher);

        var result = await controller.Grade(submission.Id, new GradeSubmissionRequest(90, "not yours to grade"));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task GetForAssignment_Rejects_WhenTeacherDoesNotOwnAssignment()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var owningTeacher = TestEntities.NewTeacher("Owning Teacher");
        var otherTeacher = TestEntities.NewTeacher("Other Teacher");
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(owningTeacher.Id, cls.Id, subject.Id);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, owningTeacher, otherTeacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(otherTeacher.Id, UserRole.Teacher);

        var result = await controller.GetForAssignment(assignment.Id);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Update_Rejects_WhenTeacherDoesNotOwnAssignment()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var owningTeacher = TestEntities.NewTeacher("Owning Teacher");
        var otherTeacher = TestEntities.NewTeacher("Other Teacher");
        var assignment = TestEntities.NewAssignment(owningTeacher.Id, cls.Id, subject.Id);

        db.AddRange(cls, subject, owningTeacher, otherTeacher, assignment);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(otherTeacher.Id, UserRole.Teacher);

        var request = new UpdateAssignmentRequest(
            "Hijacked Title", "desc", cls.Id, subject.Id, DateTime.UtcNow.AddDays(5), 100, false);
        var result = await controller.Update(assignment.Id, request);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Publish_Rejects_WhenTeacherDoesNotOwnAssignment()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var owningTeacher = TestEntities.NewTeacher("Owning Teacher");
        var otherTeacher = TestEntities.NewTeacher("Other Teacher");
        var assignment = TestEntities.NewAssignment(owningTeacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Draft);

        db.AddRange(cls, subject, owningTeacher, otherTeacher, assignment);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(otherTeacher.Id, UserRole.Teacher);

        var result = await controller.Publish(assignment.Id);

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }
}
