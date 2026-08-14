using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api/classes")]
public class ClassesController : ControllerBase
{
    private readonly AppDbContext _context;

    public ClassesController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Lists all classes. Open to any authenticated role (used for form dropdowns).</summary>
    [HttpGet]
    public async Task<ActionResult<List<ClassResponse>>> GetAll()
    {
        var classes = await _context.Classes
            .OrderBy(c => c.Name)
            .Select(c => new ClassResponse(c.Id, c.Name, c.Description))
            .ToListAsync();

        return Ok(classes);
    }
}
