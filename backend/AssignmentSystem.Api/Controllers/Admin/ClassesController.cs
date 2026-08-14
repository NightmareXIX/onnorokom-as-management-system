using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers.Admin;

[ApiController]
[Route("api/admin/classes")]
[Authorize(Roles = "Admin")]
public class ClassesController : ControllerBase
{
    private readonly AppDbContext _context;

    public ClassesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<ClassResponse>>> GetAll()
    {
        var classes = await _context.Classes
            .OrderBy(c => c.Name)
            .Select(c => new ClassResponse(c.Id, c.Name, c.Description))
            .ToListAsync();

        return Ok(classes);
    }

    [HttpPost]
    public async Task<ActionResult<ClassResponse>> Create(CreateClassRequest request)
    {
        var cls = new Class
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description
        };

        _context.Classes.Add(cls);
        await _context.SaveChangesAsync();

        var response = new ClassResponse(cls.Id, cls.Name, cls.Description);
        return CreatedAtAction(nameof(GetAll), response);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ClassResponse>> Update(Guid id, UpdateClassRequest request)
    {
        var cls = await _context.Classes.FindAsync(id);
        if (cls is null)
        {
            return NotFound();
        }

        cls.Name = request.Name;
        cls.Description = request.Description;
        await _context.SaveChangesAsync();

        return Ok(new ClassResponse(cls.Id, cls.Name, cls.Description));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var cls = await _context.Classes.FindAsync(id);
        if (cls is null)
        {
            return NotFound();
        }

        var inUse = await _context.Users.AnyAsync(u => u.ClassId == id)
            || await _context.Assignments.AnyAsync(a => a.ClassId == id)
            || await _context.TeacherAssignments.AnyAsync(ta => ta.ClassId == id);
        if (inUse)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Cannot delete a class that is in use by users, assignments, or teacher assignments.");
        }

        _context.Classes.Remove(cls);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
