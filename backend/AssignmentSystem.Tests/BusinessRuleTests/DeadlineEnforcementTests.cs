using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

public class DeadlineEnforcementTests
{
    [Fact]
    public async Task Create_Rejects_SubmissionAfterDeadline()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, deadline: DateTime.UtcNow.AddDays(-1));

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.Create(assignment.Id, new CreateSubmissionRequest("late answer", null));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
        (await db.Submissions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Create_Allows_SubmissionBeforeDeadline()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, deadline: DateTime.UtcNow.AddDays(3));

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.Create(assignment.Id, new CreateSubmissionRequest("on-time answer", null));

        result.Result.Should().BeOfType<CreatedAtActionResult>();
    }
}
