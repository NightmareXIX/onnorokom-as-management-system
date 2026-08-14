using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Identity;

namespace AssignmentSystem.Api.Data;

public static class SeedData
{
    public static void Initialize(AppDbContext context)
    {
        if (context.Users.Any())
        {
            return;
        }

        var classA = new Class { Id = Guid.NewGuid(), Name = "Class 10 - Section A", Description = "Section A of Class 10" };
        var classB = new Class { Id = Guid.NewGuid(), Name = "Class 10 - Section B", Description = "Section B of Class 10" };
        context.Classes.AddRange(classA, classB);

        var math = new Subject { Id = Guid.NewGuid(), Name = "Mathematics", Code = "MATH101" };
        var english = new Subject { Id = Guid.NewGuid(), Name = "English", Code = "ENG101" };
        var science = new Subject { Id = Guid.NewGuid(), Name = "Science", Code = "SCI101" };
        context.Subjects.AddRange(math, english, science);

        var hasher = new PasswordHasher<User>();

        var admin = new User
        {
            Id = Guid.NewGuid(),
            FullName = "System Admin",
            Email = "admin@school.com",
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        };
        admin.PasswordHash = hasher.HashPassword(admin, "Admin@123");

        var teacher = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Demo Teacher",
            Email = "teacher@school.com",
            Role = UserRole.Teacher,
            CreatedAt = DateTime.UtcNow
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Teacher@123");

        var student = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Demo Student",
            Email = "student@school.com",
            Role = UserRole.Student,
            ClassId = classA.Id,
            CreatedAt = DateTime.UtcNow
        };
        student.PasswordHash = hasher.HashPassword(student, "Student@123");

        context.Users.AddRange(admin, teacher, student);

        context.TeacherAssignments.AddRange(
            new TeacherAssignment { Id = Guid.NewGuid(), TeacherId = teacher.Id, SubjectId = math.Id, ClassId = classA.Id },
            new TeacherAssignment { Id = Guid.NewGuid(), TeacherId = teacher.Id, SubjectId = english.Id, ClassId = classA.Id }
        );

        context.SaveChanges();
    }
}
