using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

/// <summary>Filter isolation on GET /api/assignments/{id}/submissions and GET /api/submissions/me,
/// plus confirmation that ownership checks still run before any filter/paging logic touches
/// the database.</summary>
public class SubmissionFilterTests
{
    [Fact]
    public async Task GetForAssignment_StatusFilter_IsolatesCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var studentA = TestEntities.NewStudent(cls.Id, "Student A");
        var studentB = TestEntities.NewStudent(cls.Id, "Student B");
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        var submitted = TestEntities.NewSubmission(assignment.Id, studentA.Id, status: SubmissionStatus.Submitted);
        var graded = TestEntities.NewSubmission(assignment.Id, studentB.Id, status: SubmissionStatus.Graded);
        db.AddRange(cls, subject, teacher, studentA, studentB, assignment, submitted, graded);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.GetForAssignment(assignment.Id, status: SubmissionStatus.Graded);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { graded.Id });
    }

    [Fact]
    public async Task GetForAssignment_SearchByStudentName_IsCaseInsensitivePartialMatch()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var alice = TestEntities.NewStudent(cls.Id, "Alice Rahman");
        var bob = TestEntities.NewStudent(cls.Id, "Bob Karim");
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        var aliceSubmission = TestEntities.NewSubmission(assignment.Id, alice.Id);
        var bobSubmission = TestEntities.NewSubmission(assignment.Id, bob.Id);
        db.AddRange(cls, subject, teacher, alice, bob, assignment, aliceSubmission, bobSubmission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.GetForAssignment(assignment.Id, search: "alice");
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { aliceSubmission.Id });
    }

    [Fact]
    public async Task GetForAssignment_NonOwningTeacher_Still403s_RegardlessOfFilterParams()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var owningTeacher = TestEntities.NewTeacher("Owner");
        var otherTeacher = TestEntities.NewTeacher("Not Owner");
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(owningTeacher.Id, cls.Id, subject.Id);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id, status: SubmissionStatus.Graded);
        db.AddRange(cls, subject, owningTeacher, otherTeacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(otherTeacher.Id, UserRole.Teacher);

        var result = await controller.GetForAssignment(assignment.Id, page: 2, pageSize: 5, status: SubmissionStatus.Graded, search: "anything");
        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task GetMine_StatusFilter_IsolatesCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignmentA = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "A");
        var assignmentB = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "B");
        var submitted = TestEntities.NewSubmission(assignmentA.Id, student.Id, status: SubmissionStatus.Submitted);
        var graded = TestEntities.NewSubmission(assignmentB.Id, student.Id, status: SubmissionStatus.Graded);
        db.AddRange(cls, subject, teacher, student, assignmentA, assignmentB, submitted, graded);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.GetMine(status: SubmissionStatus.Graded);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { graded.Id });
    }

    [Fact]
    public async Task GetMine_AssignmentIdFilter_IsolatesCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignmentA = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "A");
        var assignmentB = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "B");
        var forA = TestEntities.NewSubmission(assignmentA.Id, student.Id);
        var forB = TestEntities.NewSubmission(assignmentB.Id, student.Id);
        db.AddRange(cls, subject, teacher, student, assignmentA, assignmentB, forA, forB);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.GetMine(assignmentId: assignmentB.Id);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { forB.Id });
    }

    [Fact]
    public async Task GetMine_SearchByAssignmentTitle_IsCaseInsensitivePartialMatch()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var algebra = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "Algebra Homework");
        var essay = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "History Essay");
        var algebraSub = TestEntities.NewSubmission(algebra.Id, student.Id);
        var essaySub = TestEntities.NewSubmission(essay.Id, student.Id);
        db.AddRange(cls, subject, teacher, student, algebra, essay, algebraSub, essaySub);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.GetMine(search: "algebra");
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { algebraSub.Id });
    }

    [Fact]
    public async Task GetMine_NeverReturnsAnotherStudentsSubmissions_RegardlessOfFilterParams()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var studentA = TestEntities.NewStudent(cls.Id, "Student A");
        var studentB = TestEntities.NewStudent(cls.Id, "Student B");
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        var ownSubmission = TestEntities.NewSubmission(assignment.Id, studentA.Id);
        var otherSubmission = TestEntities.NewSubmission(assignment.Id, studentB.Id);
        db.AddRange(cls, subject, teacher, studentA, studentB, assignment, ownSubmission, otherSubmission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(studentA.Id, UserRole.Student);

        var result = await controller.GetMine(assignmentId: assignment.Id);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { ownSubmission.Id });
    }
}
