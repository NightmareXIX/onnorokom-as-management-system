using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

public class AssignmentVisibilityTests
{
    [Fact]
    public async Task GetAll_ExcludesDraftAssignments_ForStudent()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var published = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Published);
        var draft = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Draft);

        db.AddRange(cls, subject, teacher, student, published, draft);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService(), new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.GetAll();

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = okResult.Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;
        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { published.Id });
    }

    [Fact]
    public async Task GetAll_OnlyReturnsOwnClassAssignments_ForStudent()
    {
        await using var db = TestDb.CreateContext();
        var classA = TestEntities.NewClass("Class A");
        var classB = TestEntities.NewClass("Class B");
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var studentInA = TestEntities.NewStudent(classA.Id);
        var assignmentForA = TestEntities.NewAssignment(teacher.Id, classA.Id, subject.Id, status: AssignmentStatus.Published);
        var assignmentForB = TestEntities.NewAssignment(teacher.Id, classB.Id, subject.Id, status: AssignmentStatus.Published);

        db.AddRange(classA, classB, subject, teacher, studentInA, assignmentForA, assignmentForB);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService(), new NotificationService(db));
        controller.SetUser(studentInA.Id, UserRole.Student);

        var result = await controller.GetAll();

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = okResult.Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;
        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { assignmentForA.Id });
    }

    [Fact]
    public async Task GetAll_ReturnsOwnAssignmentsRegardlessOfStatus_ForTeacher()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var otherTeacher = TestEntities.NewTeacher("Other Teacher");
        var ownPublished = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Published);
        var ownDraft = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Draft);
        var someoneElses = TestEntities.NewAssignment(otherTeacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Published);

        db.AddRange(cls, subject, teacher, otherTeacher, ownPublished, ownDraft, someoneElses);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService(), new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.GetAll();

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = okResult.Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;
        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { ownPublished.Id, ownDraft.Id });
    }
}
