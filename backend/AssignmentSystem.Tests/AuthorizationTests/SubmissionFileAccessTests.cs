using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.AuthorizationTests;

public class SubmissionFileAccessTests
{
    private static async Task<(AssignmentSystem.Api.Data.AppDbContext Db, Class Cls, Subject Subject, User Teacher, User Student, Assignment Assignment, Submission Submission, FakeFileStorageService Storage)>
        SeedWithFileAsync()
    {
        var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);

        var storage = new FakeFileStorageService();
        var storedName = await storage.SaveAsync(TestFormFile.Create(fileName: "answer.pdf"));
        var submission = TestEntities.NewSubmission(
            assignment.Id, student.Id, fileName: "answer.pdf", storedFileName: storedName, fileSizeBytes: 1024);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        return (db, cls, subject, teacher, student, assignment, submission, storage);
    }

    [Fact]
    public async Task DownloadFile_Allowed_ForOwningStudent()
    {
        var (db, _, _, _, student, _, submission, storage) = await SeedWithFileAsync();
        await using var _ = db;

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, storage, TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.DownloadFile(submission.Id);

        result.Should().BeOfType<FileStreamResult>();
    }

    [Fact]
    public async Task DownloadFile_Allowed_ForOwningTeacher()
    {
        var (db, _, _, teacher, _, _, submission, storage) = await SeedWithFileAsync();
        await using var _ = db;

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, storage, TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(teacher.Id, UserRole.Teacher);

        var result = await controller.DownloadFile(submission.Id);

        result.Should().BeOfType<FileStreamResult>();
    }

    [Fact]
    public async Task DownloadFile_Allowed_ForAdmin()
    {
        var (db, _, _, _, _, _, submission, storage) = await SeedWithFileAsync();
        await using var _ = db;
        var admin = TestEntities.NewAdmin();
        db.Add(admin);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, storage, TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(admin.Id, UserRole.Admin);

        var result = await controller.DownloadFile(submission.Id);

        result.Should().BeOfType<FileStreamResult>();
    }

    [Fact]
    public async Task DownloadFile_Rejects_ForUnrelatedStudent()
    {
        var (db, cls, _, _, _, _, submission, storage) = await SeedWithFileAsync();
        await using var _ = db;
        var otherStudent = TestEntities.NewStudent(cls.Id, "Other Student");
        db.Add(otherStudent);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, storage, TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(otherStudent.Id, UserRole.Student);

        var result = await controller.DownloadFile(submission.Id);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task DownloadFile_Rejects_ForUnrelatedTeacher()
    {
        var (db, cls, subject, _, _, _, submission, storage) = await SeedWithFileAsync();
        await using var _ = db;
        var otherTeacher = TestEntities.NewTeacher("Other Teacher");
        db.Add(otherTeacher);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, storage, TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(otherTeacher.Id, UserRole.Teacher);

        var result = await controller.DownloadFile(submission.Id);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task DownloadFile_ReturnsNotFound_WhenSubmissionHasNoFile()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);
        var submission = TestEntities.NewSubmission(assignment.Id, student.Id);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.DownloadFile(submission.Id);

        result.Should().BeOfType<NotFoundResult>();
    }
}
