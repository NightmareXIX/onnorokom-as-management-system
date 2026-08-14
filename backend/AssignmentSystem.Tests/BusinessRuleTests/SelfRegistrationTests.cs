using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Controllers.Admin;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace AssignmentSystem.Tests.BusinessRuleTests;

public class SelfRegistrationTests
{
    private static TokenService CreateTokenService()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "unit-test-only-secret-key-at-least-32-chars-long",
                ["Jwt:Issuer"] = "AssignmentSystemApi.Tests",
                ["Jwt:Audience"] = "AssignmentSystemApi.Tests",
                ["Jwt:ExpiryMinutes"] = "60"
            })
            .Build();
        return new TokenService(configuration);
    }

    private static AuthController CreateAuthController(AssignmentSystem.Api.Data.AppDbContext db)
    {
        var controller = new AuthController(db, CreateTokenService(), NullLogger<AuthController>.Instance, new NotificationService(db));
        controller.SetAnonymousHttpContext();
        return controller;
    }

    [Fact]
    public async Task Register_CreatesInactivePendingStudent_WithSubmittedClass()
    {
        var db = TestDb.CreateContext();
        await using var _ = db;
        var studentClass = TestEntities.NewClass();
        db.Classes.Add(studentClass);
        await db.SaveChangesAsync();

        var controller = CreateAuthController(db);

        var result = await controller.Register(new RegisterRequest("New Student", "new-student@test.local", "Passw0rd", studentClass.Id));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(201);

        var created = await db.Users.SingleAsync(u => u.Email == "new-student@test.local");
        created.Role.Should().Be(UserRole.Student);
        created.ClassId.Should().Be(studentClass.Id);
        created.IsActive.Should().BeFalse();
        created.PendingApproval.Should().BeTrue();
    }

    [Fact]
    public async Task Register_Rejects_DuplicateEmail()
    {
        var db = TestDb.CreateContext();
        await using var _ = db;
        var studentClass = TestEntities.NewClass();
        var existing = TestEntities.NewStudent(studentClass.Id);
        existing.Email = "taken@test.local";
        db.Classes.Add(studentClass);
        db.Users.Add(existing);
        await db.SaveChangesAsync();

        var controller = CreateAuthController(db);

        var result = await controller.Register(new RegisterRequest("Someone Else", "taken@test.local", "Passw0rd", studentClass.Id));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Register_Rejects_InvalidClassId()
    {
        var db = TestDb.CreateContext();
        await using var _ = db;

        var controller = CreateAuthController(db);

        var result = await controller.Register(new RegisterRequest("New Student", "new-student@test.local", "Passw0rd", Guid.NewGuid()));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Login_Rejects_PendingApprovalUser_WithPendingSpecificMessage()
    {
        var db = TestDb.CreateContext();
        await using var _ = db;
        var studentClass = TestEntities.NewClass();
        var pending = TestEntities.NewStudent(studentClass.Id);
        pending.Email = "pending@test.local";
        pending.IsActive = false;
        pending.PendingApproval = true;
        pending.PasswordHash = new PasswordHasher<User>().HashPassword(pending, "Passw0rd");
        db.Classes.Add(studentClass);
        db.Users.Add(pending);
        await db.SaveChangesAsync();

        var controller = CreateAuthController(db);

        var result = await controller.Login(new LoginRequest(pending.Email, "Passw0rd"));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(401);
        var problem = objectResult.Value.Should().BeAssignableTo<ProblemDetails>().Subject;
        problem.Title.Should().Contain("pending administrator approval");
    }

    [Fact]
    public async Task Login_Rejects_DeactivatedNonPendingUser_WithGenericMessage()
    {
        var db = TestDb.CreateContext();
        await using var _ = db;
        var deactivated = TestEntities.NewTeacher();
        deactivated.Email = "deactivated@test.local";
        deactivated.IsActive = false;
        deactivated.PendingApproval = false;
        deactivated.PasswordHash = new PasswordHasher<User>().HashPassword(deactivated, "Passw0rd");
        db.Users.Add(deactivated);
        await db.SaveChangesAsync();

        var controller = CreateAuthController(db);

        var result = await controller.Login(new LoginRequest(deactivated.Email, "Passw0rd"));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(401);
        var problem = objectResult.Value.Should().BeAssignableTo<ProblemDetails>().Subject;
        problem.Title.Should().Be("Invalid email or password.");
    }

    [Fact]
    public async Task FullLifecycle_RegisterThenAdminApprovesThenLogin_Succeeds()
    {
        var db = TestDb.CreateContext();
        await using var _ = db;
        var studentClass = TestEntities.NewClass();
        var admin = TestEntities.NewAdmin();
        db.Classes.Add(studentClass);
        db.Users.Add(admin);
        await db.SaveChangesAsync();

        var authController = CreateAuthController(db);
        await authController.Register(new RegisterRequest("New Student", "lifecycle@test.local", "Passw0rd", studentClass.Id));

        var firstLogin = await authController.Login(new LoginRequest("lifecycle@test.local", "Passw0rd"));
        firstLogin.Result.Should().BeOfType<ObjectResult>().Subject.StatusCode.Should().Be(401);

        var newUser = await db.Users.SingleAsync(u => u.Email == "lifecycle@test.local");
        var usersController = new UsersController(db);
        usersController.SetUser(admin.Id, UserRole.Admin);

        await usersController.Update(newUser.Id, new UpdateUserRequest(
            newUser.FullName, newUser.Email, newUser.Role, newUser.ClassId, IsActive: true));

        var approved = await db.Users.SingleAsync(u => u.Id == newUser.Id);
        approved.IsActive.Should().BeTrue();
        approved.PendingApproval.Should().BeFalse();

        var secondLogin = await authController.Login(new LoginRequest("lifecycle@test.local", "Passw0rd"));
        var okResult = secondLogin.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeAssignableTo<LoginResponse>().Subject;
        response.Role.Should().Be(UserRole.Student);
    }
}
