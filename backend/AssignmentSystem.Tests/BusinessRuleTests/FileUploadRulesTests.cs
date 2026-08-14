using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

public class FileUploadRulesTests
{
    [Fact]
    public async Task Create_Rejects_WhenFileExceedsMaxSize()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var oversizedFile = TestFormFile.Create(sizeBytes: 20 * 1024 * 1024);
        var result = await controller.Create(assignment.Id, new CreateSubmissionRequest("my answer", oversizedFile));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_Rejects_WhenExtensionNotAllowed()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, new FakeFileStorageService(), TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var exeFile = TestFormFile.Create(fileName: "virus.exe", contentType: "application/octet-stream");
        var result = await controller.Create(assignment.Id, new CreateSubmissionRequest("my answer", exeFile));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_Succeeds_WithValidFile_AndStoresMetadata()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id);

        db.AddRange(cls, subject, teacher, student, assignment);
        await db.SaveChangesAsync();

        var storage = new FakeFileStorageService();
        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, storage, TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var file = TestFormFile.Create(fileName: "homework.pdf", contentType: "application/pdf", sizeBytes: 2048);
        var result = await controller.Create(assignment.Id, new CreateSubmissionRequest("my answer", file));

        var created = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var response = created.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;
        response.FileName.Should().Be("homework.pdf");
        response.FileSizeBytes.Should().Be(2048);
        storage.Files.Should().HaveCount(1);
    }

    [Fact]
    public async Task Update_WithNewFile_DeletesOldStoredFile()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, allowResubmission: true);

        var storage = new FakeFileStorageService();
        var oldStoredName = await storage.SaveAsync(TestFormFile.Create(fileName: "old.pdf"));
        var submission = TestEntities.NewSubmission(
            assignment.Id, student.Id, fileName: "old.pdf", storedFileName: oldStoredName, fileSizeBytes: 1024);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, storage, TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var newFile = TestFormFile.Create(fileName: "new.pdf");
        var result = await controller.Update(submission.Id, new UpdateSubmissionRequest("revised answer", newFile));

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;
        response.FileName.Should().Be("new.pdf");
        storage.Files.Should().HaveCount(1);
        storage.Files.Keys.Should().NotContain(oldStoredName);
    }

    [Fact]
    public async Task Update_WithoutFile_LeavesExistingFileMetadataUntouched()
    {
        await using var db = TestDb.CreateContext();
        var cls = TestEntities.NewClass();
        var subject = TestEntities.NewSubject();
        var teacher = TestEntities.NewTeacher();
        var student = TestEntities.NewStudent(cls.Id);
        var assignment = TestEntities.NewAssignment(teacher.Id, cls.Id, subject.Id, allowResubmission: true);

        var storage = new FakeFileStorageService();
        var storedName = await storage.SaveAsync(TestFormFile.Create(fileName: "keep-me.pdf"));
        var submission = TestEntities.NewSubmission(
            assignment.Id, student.Id, fileName: "keep-me.pdf", storedFileName: storedName, fileSizeBytes: 1024);

        db.AddRange(cls, subject, teacher, student, assignment, submission);
        await db.SaveChangesAsync();

        var controller = new SubmissionsController(db, NullLogger<SubmissionsController>.Instance, storage, TestConfig.Uploads, new NotificationService(db));
        controller.SetUser(student.Id, UserRole.Student);

        var result = await controller.Update(submission.Id, new UpdateSubmissionRequest("revised text only", null));

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<SubmissionResponse>().Subject;
        response.FileName.Should().Be("keep-me.pdf");
        storage.Files.Should().ContainKey(storedName);
    }
}
