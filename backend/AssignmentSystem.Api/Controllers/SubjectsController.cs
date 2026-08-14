using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api/subjects")]
public class SubjectsController : ControllerBase
{
    private readonly AppDbContext _context;

    public SubjectsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Lists all subjects. Open to any authenticated role (used for form dropdowns).</summary>
    [HttpGet]
    public async Task<ActionResult<List<SubjectResponse>>> GetAll()
    {
        var subjects = await _context.Subjects
            .OrderBy(s => s.Name)
            .Select(s => new SubjectResponse(s.Id, s.Name, s.Code))
            .ToListAsync();

        return Ok(subjects);
    }
}
