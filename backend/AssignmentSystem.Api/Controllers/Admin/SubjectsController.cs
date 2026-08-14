using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers.Admin;

[ApiController]
[Route("api/admin/subjects")]
[Authorize(Roles = "Admin")]
public class SubjectsController : ControllerBase
{
    private readonly AppDbContext _context;

    public SubjectsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Lists all subjects (Admin only).</summary>
    [HttpGet]
    public async Task<ActionResult<List<SubjectResponse>>> GetAll()
    {
        var subjects = await _context.Subjects
            .OrderBy(s => s.Name)
            .Select(s => new SubjectResponse(s.Id, s.Name, s.Code))
            .ToListAsync();

        return Ok(subjects);
    }

    /// <summary>Creates a new subject (Admin only).</summary>
    [HttpPost]
    public async Task<ActionResult<SubjectResponse>> Create(CreateSubjectRequest request)
    {
        var subject = new Subject
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Code = request.Code
        };

        _context.Subjects.Add(subject);
        await _context.SaveChangesAsync();

        var response = new SubjectResponse(subject.Id, subject.Name, subject.Code);
        return CreatedAtAction(nameof(GetAll), response);
    }

    /// <summary>Updates a subject's name/code (Admin only).</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SubjectResponse>> Update(Guid id, UpdateSubjectRequest request)
    {
        var subject = await _context.Subjects.FindAsync(id);
        if (subject is null)
        {
            return NotFound();
        }

        subject.Name = request.Name;
        subject.Code = request.Code;
        await _context.SaveChangesAsync();

        return Ok(new SubjectResponse(subject.Id, subject.Name, subject.Code));
    }

    /// <summary>Deletes a subject (Admin only). Rejected with 400 if the subject is referenced by assignments or teacher assignments.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var subject = await _context.Subjects.FindAsync(id);
        if (subject is null)
        {
            return NotFound();
        }

        var inUse = await _context.Assignments.AnyAsync(a => a.SubjectId == id)
            || await _context.TeacherAssignments.AnyAsync(ta => ta.SubjectId == id);
        if (inUse)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Cannot delete a subject that is in use by assignments or teacher assignments.");
        }

        _context.Subjects.Remove(subject);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
