using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.SubmissionWorkflowTests;

public class SubmitAndGradeWorkflowTests
{
    [Fact]
    public async Task FullWorkflow_SubmitThenGrade_ReflectsGradedStatusMarksAndFeedback()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, maxMarks: 100);

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        // Student submits.
        var submissionsController = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        submissionsController.SetUser(student.Id, UserRole.Student);
        var createResult = await submissionsController.Create(assignment.Id, new CreateSubmissionRequest("my answer", null));
        var created = createResult.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var submission = created.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;
        submission.Status.Should().Be(SubmissionStatus.Submitted);
        submission.Marks.Should().BeNull();

        // Teacher views submissions for the assignment.
        var teacherController = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        teacherController.SetUser(teacher.Id, UserRole.Teacher);
        var listResult = await teacherController.GetForAssignment(assignment.Id);
        var listOk = listResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = listOk.Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;
        paged.Items.Should().ContainSingle(s => s.Id == submission.Id);

        // Teacher grades it.
        var gradeResult = await teacherController.Grade(submission.Id, new GradeSubmissionRequest(92, "Great work"));
        var gradeOk = gradeResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var graded = gradeOk.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;
        graded.Status.Should().Be(SubmissionStatus.Graded);
        graded.Marks.Should().Be(92);
        graded.Feedback.Should().Be("Great work");
        graded.GradedByTeacherId.Should().Be(teacher.Id);

        // Student sees the graded result via their own submissions list.
        var studentController = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        studentController.SetUser(student.Id, UserRole.Student);
        var mineResult = await studentController.GetMine();
        var mineOk = mineResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var minePaged = mineOk.Value.Should().BeAssignableTo<PagedResult<SubmissionResponse>>().Subject;
        minePaged.Items.Should().ContainSingle(s => s.Id == submission.Id && s.Marks == 92);
    }

    [Fact]
    public async Task FullWorkflow_ResubmissionAfterGrading_ClearsThePriorGrade()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, allowResubmission: true);

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        var studentController = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        studentController.SetUser(student.Id, UserRole.Student);
        var createResult = await studentController.Create(assignment.Id, new CreateSubmissionRequest("first draft", null));
        var created = createResult.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var submission = created.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;

        var teacherController = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        teacherController.SetUser(teacher.Id, UserRole.Teacher);
        await teacherController.Grade(submission.Id, new GradeSubmissionRequest(60, "needs more detail"));

        var resubmitResult = await studentController.Update(submission.Id, new UpdateSubmissionRequest("improved draft", null));
        var resubmitOk = resubmitResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var resubmitted = resubmitOk.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;

        resubmitted.Content.Should().Be("improved draft");
        resubmitted.Status.Should().Be(SubmissionStatus.Submitted);
        resubmitted.Marks.Should().BeNull();
        resubmitted.Feedback.Should().BeNull();
        resubmitted.GradedAt.Should().BeNull();
        resubmitted.GradedByTeacherId.Should().BeNull();
    }

    [Fact]
    public async Task Create_Rejects_SecondSubmission_ViaPost_MustUseUpdateInstead()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, allowResubmission: true);

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads);
        controller.SetUser(student.Id, UserRole.Student);

        var first = await controller.Create(assignment.Id, new CreateSubmissionRequest("first attempt", null));
        first.Result.Should().BeOfType<CreatedAtActionResult>();

        var second = await controller.Create(assignment.Id, new CreateSubmissionRequest("second attempt via POST", null));
        var objectResult = second.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }
}
