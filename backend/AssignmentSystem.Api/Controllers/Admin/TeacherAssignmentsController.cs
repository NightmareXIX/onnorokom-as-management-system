using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers.Admin;

[ApiController]
[Route("api/admin/teacher-assignments")]
[Authorize(Roles = "Admin")]
public class TeacherAssignmentsController : ControllerBase
{
    private readonly AppDbContext _context;

    public TeacherAssignmentsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<TeacherAssignmentResponse>>> GetAll()
    {
        var items = await _context.TeacherAssignments
            .Include(ta => ta.Teacher)
            .Include(ta => ta.Subject)
            .Include(ta => ta.Class)
            .OrderBy(ta => ta.Teacher!.FullName)
            .ToListAsync();

        return Ok(items.Select(MapToResponse).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<TeacherAssignmentResponse>> Create(CreateTeacherAssignmentRequest request)
    {
        var teacher = await _context.Users.FindAsync(request.TeacherId);
        if (teacher is null || teacher.Role != UserRole.Teacher)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "TeacherId must reference an existing Teacher account.");
        }

        var subjectExists = await _context.Subjects.AnyAsync(s => s.Id == request.SubjectId);
        var classExists = await _context.Classes.AnyAsync(c => c.Id == request.ClassId);
        if (!subjectExists || !classExists)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "SubjectId or ClassId does not exist.");
        }

        var duplicate = await _context.TeacherAssignments.AnyAsync(ta =>
            ta.TeacherId == request.TeacherId && ta.SubjectId == request.SubjectId && ta.ClassId == request.ClassId);
        if (duplicate)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "This teacher assignment already exists.");
        }

        var assignment = new TeacherAssignment
        {
            Id = Guid.NewGuid(),
            TeacherId = request.TeacherId,
            SubjectId = request.SubjectId,
            ClassId = request.ClassId
        };

        _context.TeacherAssignments.Add(assignment);
        await _context.SaveChangesAsync();

        var response = await LoadResponseAsync(assignment.Id);
        return CreatedAtAction(nameof(GetAll), response);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var assignment = await _context.TeacherAssignments.FindAsync(id);
        if (assignment is null)
        {
            return NotFound();
        }

        _context.TeacherAssignments.Remove(assignment);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task<TeacherAssignmentResponse> LoadResponseAsync(Guid id)
    {
        var ta = await _context.TeacherAssignments
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .Include(x => x.Class)
            .FirstAsync(x => x.Id == id);

        return MapToResponse(ta);
    }

    private static TeacherAssignmentResponse MapToResponse(TeacherAssignment ta) => new(
        ta.Id,
        ta.TeacherId,
        ta.Teacher?.FullName ?? string.Empty,
        ta.SubjectId,
        ta.Subject?.Name ?? string.Empty,
        ta.ClassId,
        ta.Class?.Name ?? string.Empty
    );
}
