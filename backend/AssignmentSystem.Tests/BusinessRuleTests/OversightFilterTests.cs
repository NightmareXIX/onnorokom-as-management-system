using AssignmentSystem.Api.Controllers.Admin;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Tests.BusinessRuleTests;

/// <summary>Filter isolation on the Admin oversight endpoints (GET /api/admin/assignments,
/// GET /api/admin/submissions) — entirely new coverage, since OversightController had zero
/// query params before this change.</summary>
public class OversightFilterTests
{
    [Fact]
    public async Task GetAllAssignments_TeacherIdFilter_IsolatesCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacherA = TestEntities.NewTeacher("Teacher A");
        var teacherB = TestEntities.NewTeacher("Teacher B");
        var admin = TestEntities.NewAdmin();
        var byA = TestEntities.NewAssignment(teacherA.Id, cls.Id, subject.Id);
        var byB = TestEntities.NewAssignment(teacherB.Id, cls.Id, subject.Id);
        db.AddRange(cls, subject, teacherA, teacherB, admin, byA, byB);
        await db.SaveChangesAsync();

        var controller = new OversightController(db);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAllAssignments(teacherId: teacherB.Id);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;

        paged.Items.Select(a => a.Id).Should().BeEquivalentTo(new[] { byB.Id });
    }

    [Fact]
    public async Task GetAllAssignments_ClassSubjectStatusSearch_EachIsolateCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var classA = TestEntities.NewClass("Class A");
        var classB = TestEntities.NewClass("Class B");
        var subjectA = TestEntities.NewSubject("Mathematics");
        var subjectB = TestEntities.NewSubject("Science");
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var target = TestEntities.NewAssignment(teacher.Id, classA.Id, subjectA.Id, status: AssignmentStatus.Published, title: "Algebra Homework");
        var other1 = TestEntities.NewAssignment(teacher.Id, classB.Id, subjectA.Id, status: AssignmentStatus.Published, title: "Other 1");
        var other2 = TestEntities.NewAssignment(teacher.Id, classA.Id, subjectB.Id, status: AssignmentStatus.Published, title: "Other 2");
        var other3 = TestEntities.NewAssignment(teacher.Id, classA.Id, subjectA.Id, status: AssignmentStatus.Draft, title: "Other 3");
        db.AddRange(classA, classB, subjectA, subjectB, teacher, admin, target, other1, other2, other3);
        await db.SaveChangesAsync();

        var controller = new OversightController(db);
        controller.SetUser(admin.Id, UserRole.Admin);

        (await GetItems(controller.GetAllAssignments(classId: classA.Id))).Should().Contain(target.Id).And.NotContain(other1.Id);
        (await GetItems(controller.GetAllAssignments(subjectId: subjectA.Id))).Should().Contain(target.Id).And.NotContain(other2.Id);
        (await GetItems(controller.GetAllAssignments(status: AssignmentStatus.Published))).Should().Contain(target.Id).And.NotContain(other3.Id);
        (await GetItems(controller.GetAllAssignments(search: "algebra"))).Should().BeEquivalentTo(new[] { target.Id });

        static async Task<IEnumerable<Guid>> GetItems(Task<ActionResult<PagedResult<AssignmentResponse>>> task)
        {
            var result = await task;
            var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<AssignmentResponse>>().Subject;
            return paged.Items.Select(a => a.Id);
        }
    }

    [Fact]
    public async Task GetAllSubmissions_AssignmentIdAndStudentIdFilters_IsolateCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var studentA = TestEntities.NewStudent(cls.Id, "Student A");
        var studentB = TestEntities.NewStudent(cls.Id, "Student B");
        var assignmentA = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "A");
        var assignmentB = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "B");
        var target = TestEntities.NewSubmission(assignmentA.Id, studentA.Id);
        var other1 = TestEntities.NewSubmission(assignmentB.Id, studentA.Id);
        var other2 = TestEntities.NewSubmission(assignmentA.Id, studentB.Id);
        db.AddRange(cls, subject, teacher, admin, studentA, studentB, assignmentA, assignmentB, target, other1, other2);
        await db.SaveChangesAsync();

        var controller = new OversightController(db);
        controller.SetUser(admin.Id, UserRole.Admin);

        var byAssignment = await controller.GetAllSubmissions(assignmentId: assignmentA.Id);
        var byAssignmentPaged = ((OkObjectResult)byAssignment.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;
        byAssignmentPaged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { target.Id, other2.Id });

        var byStudent = await controller.GetAllSubmissions(studentId: studentA.Id);
        var byStudentPaged = ((OkObjectResult)byStudent.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;
        byStudentPaged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { target.Id, other1.Id });
    }

    [Fact]
    public async Task GetAllSubmissions_StatusFilter_IsolatesCorrectly()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        var submitted = TestEntities.NewSubmission(assignment.Id, student.Id, status: SubmissionStatus.Submitted);
        var graded = TestEntities.NewSubmission(assignment.Id, student.Id, status: SubmissionStatus.Graded);
        db.AddRange(cls, subject, teacher, admin, student, assignment, submitted, graded);
        await db.SaveChangesAsync();

        var controller = new OversightController(db);
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.GetAllSubmissions(status: SubmissionStatus.Graded);
        var paged = ((OkObjectResult)result.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;

        paged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { graded.Id });
    }

    [Fact]
    public async Task GetAllSubmissions_SearchMatchesEitherStudentNameOrAssignmentTitle()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var admin = TestEntities.NewAdmin();
        var alice = TestEntities.NewStudent(cls.Id, "Alice Rahman");
        var bob = TestEntities.NewStudent(cls.Id, "Bob Karim");
        var algebra = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "Algebra Homework");
        var essay = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, title: "History Essay");

        var matchesByStudentName = TestEntities.NewSubmission(essay.Id, alice.Id);
        var matchesByAssignmentTitle = TestEntities.NewSubmission(algebra.Id, bob.Id);
        var matchesNeither = TestEntities.NewSubmission(essay.Id, bob.Id);
        db.AddRange(cls, subject, teacher, admin, alice, bob, algebra, essay, matchesByStudentName, matchesByAssignmentTitle, matchesNeither);
        await db.SaveChangesAsync();

        var controller = new OversightController(db);
        controller.SetUser(admin.Id, UserRole.Admin);

        var aliceSearch = await controller.GetAllSubmissions(search: "alice");
        var alicePaged = ((OkObjectResult)aliceSearch.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;
        alicePaged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { matchesByStudentName.Id });

        var algebraSearch = await controller.GetAllSubmissions(search: "algebra");
        var algebraPaged = ((OkObjectResult)algebraSearch.Result!).Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;
        algebraPaged.Items.Select(s => s.Id).Should().BeEquivalentTo(new[] { matchesByAssignmentTitle.Id });
    }
}
