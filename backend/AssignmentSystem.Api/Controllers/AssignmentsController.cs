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
    private readonly ILogger<AssignmentsController> _logger;

    public AssignmentsController(AppDbContext context, ILogger<AssignmentsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>Creates an assignment (Teacher only). The caller becomes the owning teacher.</summary>
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
            Status = request.Status,
            AllowResubmission = request.AllowResubmission,
            CreatedAt = DateTime.UtcNow
        };

        _context.Assignments.Add(assignment);
        await _context.SaveChangesAsync();

        var response = await LoadResponseAsync(assignment.Id);
        return CreatedAtAction(nameof(GetById), new { id = assignment.Id }, response);
    }

    /// <summary>Lists assignments, filtered by role: Teacher sees own, Student sees own-class + Published, Admin sees all. Supports paging (page/pageSize) and, for Teacher/Admin, status/classId/subjectId/search filters — a Student's class/status is always server-forced and cannot be overridden via query params.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<AssignmentResponse>>> GetAll(
        int page = 1, int pageSize = 20,
        AssignmentStatus? status = null, Guid? classId = null, Guid? subjectId = null, string? search = null)
    {
        (page, pageSize) = PagingDefaults.Clamp(page, pageSize);

        var userId = User.GetUserId();
        var query = _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.Teacher)
            .AsQueryable();

        if (User.IsInRole("Teacher"))
        {
            query = query.Where(a => a.TeacherId == userId);

            if (status is not null)
            {
                query = query.Where(a => a.Status == status);
            }
            if (classId is not null)
            {
                query = query.Where(a => a.ClassId == classId);
            }
        }
        else if (User.IsInRole("Student"))
        {
            var ownClassId = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.ClassId)
                .FirstOrDefaultAsync();

            // Forced and unconditional: a Student's incoming `status`/`classId` query params
            // are never read in this branch, so there is no path for a Student to see a Draft
            // assignment or another class's assignments via query-string manipulation.
            query = ownClassId is null
                ? query.Where(a => false)
                : query.Where(a => a.ClassId == ownClassId && a.Status == AssignmentStatus.Published);
        }
        else
        {
            // Admin: no ownership/forced filter — sees everything, all filters optional.
            if (status is not null)
            {
                query = query.Where(a => a.Status == status);
            }
            if (classId is not null)
            {
                query = query.Where(a => a.ClassId == classId);
            }
        }

        if (subjectId is not null)
        {
            query = query.Where(a => a.SubjectId == subjectId);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(a => a.Title.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();
        var assignments = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new PagedResult<AssignmentResponse>(
            assignments.Select(AssignmentResponseMapper.Map).ToList(), page, pageSize, totalCount));
    }

    /// <summary>Gets a single assignment by id. Open to any authenticated role.</summary>
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

        return Ok(AssignmentResponseMapper.Map(assignment));
    }

    /// <summary>Updates an assignment's fields (Teacher, owner only).</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Teacher")]
    public async Task<ActionResult<AssignmentResponse>> Update(Guid id, UpdateAssignmentRequest request)
    {
        var teacherId = User.GetUserId();

        var assignment = await _context.Assignments.FindAsync(id);
        if (assignment is null)
        {
            return NotFound();
        }

        if (assignment.TeacherId != teacherId)
        {
            return Forbidden("You do not own this assignment.");
        }

        var classExists = await _context.Classes.AnyAsync(c => c.Id == request.ClassId);
        var subjectExists = await _context.Subjects.AnyAsync(s => s.Id == request.SubjectId);
        if (!classExists || !subjectExists)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "ClassId or SubjectId does not exist.");
        }

        assignment.Title = request.Title;
        assignment.Description = request.Description;
        assignment.ClassId = request.ClassId;
        assignment.SubjectId = request.SubjectId;
        assignment.Deadline = request.Deadline;
        assignment.MaxMarks = request.MaxMarks;
        assignment.AllowResubmission = request.AllowResubmission;
        assignment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(await LoadResponseAsync(assignment.Id));
    }

    /// <summary>Deletes an assignment (Teacher, owner only).</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var teacherId = User.GetUserId();

        var assignment = await _context.Assignments.FindAsync(id);
        if (assignment is null)
        {
            return NotFound();
        }

        if (assignment.TeacherId != teacherId)
        {
            return Forbidden("You do not own this assignment.");
        }

        _context.Assignments.Remove(assignment);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>Transitions an assignment from Draft to Published (Teacher, owner only).</summary>
    [HttpPatch("{id:guid}/publish")]
    [Authorize(Roles = "Teacher")]
    public async Task<ActionResult<AssignmentResponse>> Publish(Guid id)
    {
        var teacherId = User.GetUserId();

        var assignment = await _context.Assignments.FindAsync(id);
        if (assignment is null)
        {
            return NotFound();
        }

        if (assignment.TeacherId != teacherId)
        {
            return Forbidden("You do not own this assignment.");
        }

        if (assignment.Status == AssignmentStatus.Published)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Assignment is already published.");
        }

        assignment.Status = AssignmentStatus.Published;
        assignment.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(await LoadResponseAsync(assignment.Id));
    }

    private ObjectResult Forbidden(string title)
    {
        _logger.LogWarning(
            "Authorization rejected (403): user {UserId} -> {Title} ({Method} {Path})",
            User.GetUserId(), title, Request.Method, Request.Path);
        return Problem(statusCode: StatusCodes.Status403Forbidden, title: title);
    }

    private async Task<AssignmentResponse> LoadResponseAsync(Guid id)
    {
        var assignment = await _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.Teacher)
            .FirstAsync(a => a.Id == id);

        return AssignmentResponseMapper.Map(assignment);
    }
}
