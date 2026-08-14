using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

/// <summary>Filter isolation on GET /api/assignments (status/classId/subjectId/search), plus the
/// security-critical guarantee that a Student's forced own-class/Published-only visibility
/// cannot be overridden by query-string filter values.</summary>
public class AssignmentFilterTests
{
    [Fact]
    public async Task GetAll_Admin_StatusFilter_IsolatesCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var published = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Published);
        var draft = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Draft);
        db.AddRange(cls, subject, teacher, admin, published, draft);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(status: AssignmentStatus.Draft);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { draft.Id });
    }

    [Fact]
    public async Task GetAll_Admin_ClassIdFilter_IsolatesCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var classA = TestEntities.NewClass("Class A");
        var classB = TestEntities.NewClass("Class B");
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var inA = TestEntities.NewAssignment(teacher.Id, classA.Id, subject.Id);
        var inB = TestEntities.NewAssignment(teacher.Id, classB.Id, subject.Id);
        db.AddRange(classA, classB, subject, teacher, admin, inA, inB);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(classId: classA.Id);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { inA.Id });
    }

    [Fact]
    public async Task GetAll_Admin_SubjectIdFilter_IsolatesCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subjectA = TestEntities.NewSubject("Mathematics");
        var subjectB = TestEntities.NewSubject("Science");
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var forA = TestEntities.NewAssignment(teacher.Id, cls.Id, subjectA.Id);
        var forB = TestEntities.NewAssignment(teacher.Id, cls.Id, subjectB.Id);
        db.AddRange(cls, subjectA, subjectB, teacher, admin, forA, forB);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(subjectId: subjectB.Id);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { forB.Id });
    }

    [Fact]
    public async Task GetAll_Admin_SearchByTitle_IsCaseInsensitivePartialMatch()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var algebra = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "Algebra Homework");
        var essay = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "History Essay");
        db.AddRange(cls, subject, teacher, admin, algebra, essay);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(search: "algebra");
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { algebra.Id });
    }

    [Fact]
    public async Task GetAll_Admin_CombinedFilters_NarrowTogether()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var matchesBoth = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Published);
        var wrongStatus = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Draft);
        db.AddRange(cls, subject, teacher, admin, matchesBoth, wrongStatus);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAll(status: AssignmentStatus.Published, classId: cls.Id);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { matchesBoth.Id });
    }

    [Fact]
    public async Task GetAll_Student_CannotBypassForcedClassOrStatusFilter_ViaQueryParams()
    {
        await using var db = TestDb.CreateContext();
        var classA = TestEntities.NewClass("Class A");
        var classB = TestEntities.NewClass("Class B");
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var studentInA = TestEntities.NewStudent(classA.Id);
        var draftInA = TestEntities.NewAssignment(teacher.Id, classA.Id, subject.Id, status: AssignmentStatus.Draft);
        var publishedInB = TestEntities.NewAssignment(teacher.Id, classB.Id, subject.Id, status: AssignmentStatus.Published);
        db.AddRange(classA, classB, subject, teacher, studentInA, draftInA, publishedInB);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(studentInA.Id, UserRole.Student);

        // Attempt to see the Draft assignment in the student's own class, and the Published
        // assignment in a different class, by supplying those exact values as query params.
        var attempt = await controller.GetAll(status: AssignmentStatus.Draft, classId: classB.Id);
        var attemptPaged = ((OkObjectResult)attempt.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        var baseline = await controller.GetAll();
        var baselinePaged = ((OkObjectResult)baseline.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        attemptPaged.Items.Select(a => a.Id).Should().BeEquivalentTo(baselinePaged.Items.Select(a => a.Id));
        attemptPaged.Items.Should().BeEmpty("the student's only visible assignment would be Published+ClassA, and none exists here");
    }

    [Fact]
    public async Task GetAll_Teacher_OwnershipStillEnforced_WithFiltersApplied()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var otherTeacher = TestEntities.NewTeacher("Other Teacher");
        var own = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Published);
        var someoneElses = TestEntities.NewAssignment(otherTeacher.Id, cls.Id, subject.Id, status: AssignmentStatus.Published);
        db.AddRange(cls, subject, teacher, otherTeacher, own, someoneElses);
        await db.SaveChangesAsync();

        var controller = new AssignmentsController(db, NullLogger<AssignmentsController>.Instance, new FakeFileStorageService());
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.GetAll(status: AssignmentStatus.Published, classId: cls.Id);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { own.Id });
    }
}
