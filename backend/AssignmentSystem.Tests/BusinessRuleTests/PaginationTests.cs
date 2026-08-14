using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Controllers.Admin;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

/// <summary>Paging math (page/pageSize/TotalCount/TotalPages), run as a full matrix against
/// GetAll + GetMine and lighter smoke coverage for the other 3 list endpoints, since the
/// paging logic itself is the same code shape everywhere.</summary>
public class PaginationTests
{
    private static async Task<(AssignmentSystem.Api.Data.AppDbContext Db, Class Class, Subject Subject, User Teacher, User Admin, List<Assignment> Assignments)> SeedAssignmentsAsync(int count)
    {
        var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        db.AddRange(cls, subject, teacher, admin);

        var baseTime = DateTime.UtcNow;
        var assignments = Enumerable.Range(0, count)
            .Select(i => TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, createdAt: baseTime.AddMinutes(i)))
            .ToList();
        db.AddRange(assignments);
        await db.SaveChangesAsync();

        return (db, cls, subject, teacher, admin, assignments);
    }

    [Fact]
    public async Task GetAll_ReturnsCorrectPage_AndItems()
    {
        var (db, _, _, _, admin, assignments) = await SeedAssignmentsAsync(25);
        await using var _db = db;

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(page: 2, pageSize: 10);
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = okResult.Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Page.Should().Be(2);
        paged.PageSize.Should().Be(10);
        paged.TotalCount.Should().Be(25);
        paged.Items.Should().HaveCount(10);

        var expectedIds = assignments.OrderByDescending(a => a.CreatedAt).Skip(10).Take(10).Select(a => a.Id);
        paged.Items.Select(a => a.Id).Should().Equal(expectedIds);
    }

    [Fact]
    public async Task GetAll_LastPartialPage_ReturnsRemainder()
    {
        var (db, _, _, _, admin, _) = await SeedAssignmentsAsync(25);
        await using var _db = db;

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(page: 3, pageSize: 10);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Should().HaveCount(5);
        paged.TotalCount.Should().Be(25);
        paged.TotalPages.Should().Be(3);
    }

    [Fact]
    public async Task GetAll_OutOfRangePage_ReturnsEmptyItems_ButCorrectTotalCount()
    {
        var (db, _, _, _, admin, _) = await SeedAssignmentsAsync(25);
        await using var _db = db;

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(page: 99, pageSize: 10);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Should().BeEmpty();
        paged.TotalCount.Should().Be(25);
        paged.TotalPages.Should().Be(3);
    }

    [Fact]
    public async Task GetAll_PageSizeAboveMax_IsClamped()
    {
        var (db, _, _, _, admin, _) = await SeedAssignmentsAsync(5);
        await using var _db = db;

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(page: 1, pageSize: 500);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.PageSize.Should().Be(PagingDefaults.MaxPageSize);
    }

    [Fact]
    public async Task GetAll_DefaultsApplied_WhenNoParamsGiven()
    {
        var (db, _, _, _, admin, _) = await SeedAssignmentsAsync(1);
        await using var _db = db;

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll();
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Page.Should().Be(1);
        paged.PageSize.Should().Be(PagingDefaults.DefaultPageSize);
    }

    private static async Task<(AssignmentSystem.Api.Data.AppDbContext Db, User Student, List<Submission> Submissions)> SeedSubmissionsAsync(int count)
    {
        var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        db.AddRange(cls, subject, teacher, student, assignment);

        var baseTime = DateTime.UtcNow;
        var submissions = Enumerable.Range(0, count)
            .Select(i => TestEntities.NewSubmission(assignment.Id, student.Id, submittedAt: baseTime.AddMinutes(i)))
            .ToList();
        db.AddRange(submissions);
        await db.SaveChangesAsync();

        return (db, student, submissions);
    }

    [Fact]
    public async Task GetMine_ReturnsCorrectPage_AndItems()
    {
        var (db, student, submissions) = await SeedSubmissionsAsync(25);
        await using var _db = db;

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance);
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.GetMine(page: 2, pageSize: 10);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Should().HaveCount(10);
        paged.TotalCount.Should().Be(25);

        var expectedIds = submissions.OrderByDescending(s => s.SubmittedAt).Skip(10).Take(10).Select(s => s.Id);
        paged.Items.Select(s => s.Id).Should().Equal(expectedIds);
    }

    [Fact]
    public async Task GetMine_LastPartialPage_ReturnsRemainder()
    {
        var (db, student, _) = await SeedSubmissionsAsync(25);
        await using var _db = db;

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance);
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.GetMine(page: 3, pageSize: 10);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Should().HaveCount(5);
        paged.TotalCount.Should().Be(25);
    }

    [Fact]
    public async Task GetMine_OutOfRangePage_ReturnsEmptyItems_ButCorrectTotalCount()
    {
        var (db, student, _) = await SeedSubmissionsAsync(25);
        await using var _db = db;

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance);
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.GetMine(page: 99, pageSize: 10);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Should().BeEmpty();
        paged.TotalCount.Should().Be(25);
    }

    [Fact]
    public async Task GetForAssignment_HonorsPageAndPageSize()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        db.AddRange(cls, subject, teacher, assignment);

        var baseTime = DateTime.UtcNow;
        var students = Enumerable.Range(0, 15).Select(i => TestEntities.NewStudent(cls.Id, $"Student {i}")).ToList();
        db.AddRange(students);
        var submissions = students.Select((s, i) => TestEntities.NewSubmission(assignment.Id, s.Id, submittedAt: baseTime.AddMinutes(i))).ToList();
        db.AddRange(submissions);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance);
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.GetForAssignment(assignment.Id, page: 2, pageSize: 10);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.TotalCount.Should().Be(15);
        paged.Items.Should().HaveCount(5);
    }

    [Fact]
    public async Task GetAllAssignments_Oversight_HonorsPageAndPageSize()
    {
        var (db, _, _, _, admin, _) = await SeedAssignmentsAsync(15);
        await using var _db = db;

        var controller = new OversightController(db);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAllAssignments(page: 2, pageSize: 10);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.TotalCount.Should().Be(15);
        paged.Items.Should().HaveCount(5);
    }

    [Fact]
    public async Task GetAllSubmissions_Oversight_HonorsPageAndPageSize()
    {
        var (db, student, _) = await SeedSubmissionsAsync(15);
        await using var _db = db;

        var admin = TestEntities.NewAdmin();
        db.Add(admin);
        await db.SaveChangesAsync();

        var controller = new OversightController(db);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAllSubmissions(page: 2, pageSize: 10);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.TotalCount.Should().Be(15);
        paged.Items.Should().HaveCount(5);
        _ = student; // owner of the submissions; not otherwise asserted on here
    }
}
