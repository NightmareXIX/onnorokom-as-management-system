using AssignmentSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Class> Classes => Set<Class>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<TeacherAssignment> TeacherAssignments => Set<TeacherAssignment>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();

            // Restrict, not cascade/set-null: an Admin must reassign a class's students
            // before the class itself can be deleted.
            entity.HasOne(u => u.Class)
                .WithMany()
                .HasForeignKey(u => u.ClassId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TeacherAssignment>(entity =>
        {
            entity.HasOne(ta => ta.Teacher)
                .WithMany()
                .HasForeignKey(ta => ta.TeacherId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(ta => ta.Subject)
                .WithMany()
                .HasForeignKey(ta => ta.SubjectId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(ta => ta.Class)
                .WithMany()
                .HasForeignKey(ta => ta.ClassId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Assignment>(entity =>
        {
            entity.HasOne(a => a.Class)
                .WithMany()
                .HasForeignKey(a => a.ClassId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.Subject)
                .WithMany()
                .HasForeignKey(a => a.SubjectId)
                .OnDelete(DeleteBehavior.Restrict);

            // Restrict: deleting a User (a teacher) must not silently delete their
            // assignments, and must not cascade into Submissions via a second path.
            entity.HasOne(a => a.Teacher)
                .WithMany()
                .HasForeignKey(a => a.TeacherId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Submission>(entity =>
        {
            // The one explicit cascade in the model: deleting an Assignment takes its
            // Submissions with it.
            entity.HasOne(s => s.Assignment)
                .WithMany(a => a.Submissions)
                .HasForeignKey(s => s.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.Student)
                .WithMany()
                .HasForeignKey(s => s.StudentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(s => s.GradedByTeacher)
                .WithMany()
                .HasForeignKey(s => s.GradedByTeacherId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            // Restrict, matching every other User FK: users are never hard-deleted anyway.
            entity.HasOne(n => n.RecipientUser)
                .WithMany()
                .HasForeignKey(n => n.RecipientUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Cascade: a notification about a deleted assignment/submission is meaningless.
            // AssignmentId and SubmissionId are never both set on the same row (see the
            // Notification model), so this never creates a second delete path alongside the
            // existing Assignment -> Submission cascade above.
            entity.HasOne(n => n.Assignment)
                .WithMany()
                .HasForeignKey(n => n.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(n => n.Submission)
                .WithMany()
                .HasForeignKey(n => n.SubmissionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
