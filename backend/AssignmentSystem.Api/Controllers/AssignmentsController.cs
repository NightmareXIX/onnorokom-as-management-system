using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api/assignments")]
public class AssignmentsController : ControllerBase
{
    private readonly AppDbContext _context;

    public AssignmentsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    [Authorize(Roles = "Teacher")]
    public async Task<ActionResult<AssignmentResponse>> Create(CreateAssignmentRequest request)
    {
        var teacherId = User.GetUserId();

        var classExists = await _context.Classes.AnyAsync(c => c.Id == request.ClassId);
        var subjectExists = await _context.Subjects.AnyAsync(s => s.Id == request.SubjectId);
        if (!classExists || !subjectExists)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "ClassId or SubjectId does not exist.");
        }

        var assignment = new Assignment
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            ClassId = request.ClassId,
            SubjectId = request.SubjectId,
            TeacherId = teacherId,
            Deadline = request.Deadline,
            MaxMarks = request.MaxMarks,
            Status = AssignmentStatus.Published,
            AllowResubmission = request.AllowResubmission,
            CreatedAt = DateTime.UtcNow
        };

        _context.Assignments.Add(assignment);
        await _context.SaveChangesAsync();

        var response = await LoadResponseAsync(assignment.Id);
        return CreatedAtAction(nameof(GetById), new { id = assignment.Id }, response);
    }

    [HttpGet]
    public async Task<ActionResult<List<AssignmentResponse>>> GetAll()
    {
        var userId = User.GetUserId();
        var query = _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.Teacher)
            .AsQueryable();

        if (User.IsInRole("Teacher"))
        {
            query = query.Where(a => a.TeacherId == userId);
        }
        else if (User.IsInRole("Student"))
        {
            var classId = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.ClassId)
                .FirstOrDefaultAsync();

            query = classId is null
                ? query.Where(a => false)
                : query.Where(a => a.ClassId == classId);
        }
        // Admin: no filter — sees everything.

        var assignments = await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
        return Ok(assignments.Select(MapToResponse).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AssignmentResponse>> GetById(Guid id)
    {
        var assignment = await _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.Teacher)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (assignment is null)
        {
            return NotFound();
        }

        return Ok(MapToResponse(assignment));
    }

    private async Task<AssignmentResponse> LoadResponseAsync(Guid id)
    {
        var assignment = await _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.Teacher)
            .FirstAsync(a => a.Id == id);

        return MapToResponse(assignment);
    }

    private static AssignmentResponse MapToResponse(Assignment a) => new(
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
    );
}
