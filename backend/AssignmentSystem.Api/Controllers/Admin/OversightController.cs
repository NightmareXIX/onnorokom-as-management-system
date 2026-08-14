using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers.Admin;

[ApiController]
[Authorize(Roles = "Admin")]
public class OversightController : ControllerBase
{
    private readonly AppDbContext _context;

    public OversightController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("api/admin/assignments")]
    public async Task<ActionResult<List<AssignmentResponse>>> GetAllAssignments()
    {
        var assignments = await _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.Teacher)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        var response = assignments.Select(a => new AssignmentResponse(
            a.Id,
            a.Title,
            a.Description,
            a.ClassId,
            a.Class?.Name ?? string.Empty,
            a.SubjectId,
            a.Subject?.Name ?? string.Empty,
            a.TeacherId,
            a.Teacher?.FullName ?? string.Empty,
            a.Deadline,
            a.MaxMarks,
            a.Status,
            a.AllowResubmission,
            a.CreatedAt,
            a.UpdatedAt
        )).ToList();

        return Ok(response);
    }

    [HttpGet("api/admin/submissions")]
    public async Task<ActionResult<List<SubmissionResponse>>> GetAllSubmissions()
    {
        var submissions = await _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .OrderByDescending(s => s.SubmittedAt)
            .ToListAsync();

        var response = submissions.Select(s => new SubmissionResponse(
            s.Id,
            s.AssignmentId,
            s.Assignment?.Title ?? string.Empty,
            s.StudentId,
            s.Student?.FullName ?? string.Empty,
            s.Content,
            s.Status,
            s.Marks,
            s.Feedback,
            s.SubmittedAt,
            s.UpdatedAt,
            s.GradedAt,
            s.GradedByTeacherId
        )).ToList();

        return Ok(response);
    }
}
