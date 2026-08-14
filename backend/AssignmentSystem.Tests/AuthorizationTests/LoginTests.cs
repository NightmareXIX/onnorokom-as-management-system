using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Tests.TestHelpers;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace AssignmentSystem.Tests.AuthorizationTests;

public class LoginTests
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

    private static async Task<(AssignmentSystem.Api.Data.AppDbContext Db, User Seeded)> SeedUserAsync(string password, bool isActive = true)
    {
        var db = TestDb.CreateContext();
        var user = TestEntities.NewTeacher();
        user.Email = "known-user@test.local";
        user.IsActive = isActive;
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, password);

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return (db, user);
    }

    [Fact]
    public async Task Login_Rejects_WrongPassword()
    {
        var (db, user) = await SeedUserAsync("Correct@123");
        await using var _ = db;

        var controller = new AuthController(db, CreateTokenService());
        controller.SetAnonymousHttpContext();

        var result = await controller.Login(new LoginRequest(user.Email, "Wrong@123"));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Login_Rejects_UnknownEmail()
    {
        var (db, _) = await SeedUserAsync("Correct@123");
        await using var _ = db;

        var controller = new AuthController(db, CreateTokenService());
        controller.SetAnonymousHttpContext();

        var result = await controller.Login(new LoginRequest("nobody@test.local", "Correct@123"));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Login_Rejects_InactiveUser()
    {
        var (db, user) = await SeedUserAsync("Correct@123", isActive: false);
        await using var _ = db;

        var controller = new AuthController(db, CreateTokenService());
        controller.SetAnonymousHttpContext();

        var result = await controller.Login(new LoginRequest(user.Email, "Correct@123"));

        var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Login_Succeeds_WithCorrectCredentials()
    {
        var (db, user) = await SeedUserAsync("Correct@123");
        await using var _ = db;

        var controller = new AuthController(db, CreateTokenService());
        controller.SetAnonymousHttpContext();

        var result = await controller.Login(new LoginRequest(user.Email, "Correct@123"));

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeAssignableTo<LoginResponse>().Subject;
        response.Token.Should().NotBeNullOrWhiteSpace();
        response.Role.Should().Be(UserRole.Teacher);
    }
}
