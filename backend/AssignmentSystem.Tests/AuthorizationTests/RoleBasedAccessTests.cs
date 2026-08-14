using System.Reflection;
using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Api.Models;
using FluentAssertions;
using static AssignmentSystem.Tests.TestHelpers.RoleAuthorizationTestHelper;

namespace AssignmentSystem.Tests.AuthorizationTests;

/// <summary>
/// Verifies the [Authorize(Roles = "...")] attributes actually declared on these endpoints reject
/// the wrong role, using the real IAuthorizationService (see RoleAuthorizationTestHelper) rather
/// than a running server — this is what a Student/Teacher JWT would be checked against at request
/// time by the JWT bearer + authorization middleware.
/// </summary>
public class RoleBasedAccessTests
{
    private static readonly MethodInfo CreateAssignment =
        typeof(AssignmentsController).GetMethod(nameof(AssignmentsController.Create))!;

    private static readonly MethodInfo AdminGetAllUsers =
        typeof(AssignmentSystem.Api.Controllers.Admin.UsersController)
            .GetMethod(nameof(AssignmentSystem.Api.Controllers.Admin.UsersController.GetAll))!;

    [Fact]
    public async Task StudentToken_Rejected_From_TeacherOnly_CreateAssignment()
    {
        var student = PrincipalFor(UserRole.Student);

        var authorized = await IsAuthorizedAsync(CreateAssignment, student);

        authorized.Should().BeFalse();
    }

    [Fact]
    public async Task StudentToken_Rejected_From_AdminOnly_UsersList()
    {
        var student = PrincipalFor(UserRole.Student);

        var authorized = await IsAuthorizedAsync(AdminGetAllUsers, student);

        authorized.Should().BeFalse();
    }

    [Fact]
    public async Task TeacherToken_Rejected_From_AdminOnly_UsersList()
    {
        var teacher = PrincipalFor(UserRole.Teacher);

        var authorized = await IsAuthorizedAsync(AdminGetAllUsers, teacher);

        authorized.Should().BeFalse();
    }

    [Fact]
    public async Task TeacherToken_Allowed_For_TeacherOnly_CreateAssignment()
    {
        var teacher = PrincipalFor(UserRole.Teacher);

        var authorized = await IsAuthorizedAsync(CreateAssignment, teacher);

        authorized.Should().BeTrue();
    }

    [Fact]
    public async Task AdminToken_Allowed_For_AdminOnly_UsersList()
    {
        var admin = PrincipalFor(UserRole.Admin);

        var authorized = await IsAuthorizedAsync(AdminGetAllUsers, admin);

        authorized.Should().BeTrue();
    }

    [Fact]
    public async Task UnauthenticatedPrincipal_Rejected_From_ProtectedEndpoint()
    {
        var authorized = await IsAuthorizedAsync(CreateAssignment, Anonymous());

        authorized.Should().BeFalse();
    }
}
