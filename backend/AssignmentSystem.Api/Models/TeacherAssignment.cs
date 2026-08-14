namespace AssignmentSystem.Api.Models;

/// <summary>Says which teacher teaches which subject to which class.</summary>
public class TeacherAssignment
{
    public Guid Id { get; set; }

    public Guid TeacherId { get; set; }
    public User? Teacher { get; set; }

    public Guid SubjectId { get; set; }
    public Subject? Subject { get; set; }

    public Guid ClassId { get; set; }
    public Class? Class { get; set; }
}
