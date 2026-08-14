using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Models;
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

    /// <summary>Lists every assignment in the system, any status, unfiltered by owner (Admin only, oversight view). Supports paging and status/classId/subjectId/teacherId/search filters.</summary>
    [HttpGet("api/admin/assignments")]
    public async Task<ActionResult<PagedResult<AssignmentResponse>>> GetAllAssignments(
        int page = 1, int pageSize = 20,
        AssignmentStatus? status = null, Guid? classId = null, Guid? subjectId = null,
        Guid? teacherId = null, string? search = null)
    {
        (page, pageSize) = PagingDefaults.Clamp(page, pageSize);

        var query = _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.Teacher)
            .AsQueryable();

        if (status is not null)
        {
            query = query.Where(a => a.Status == status);
        }
        if (classId is not null)
        {
            query = query.Where(a => a.ClassId == classId);
        }
        if (subjectId is not null)
        {
            query = query.Where(a => a.SubjectId == subjectId);
        }
        if (teacherId is not null)
        {
            query = query.Where(a => a.TeacherId == teacherId);
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

    /// <summary>Lists every submission in the system, unfiltered by owner (Admin only, oversight view). Supports paging and status/assignmentId/studentId/search (student or assignment name) filters.</summary>
    [HttpGet("api/admin/submissions")]
    public async Task<ActionResult<PagedResult<SubmissionResponse>>> GetAllSubmissions(
        int page = 1, int pageSize = 20,
        SubmissionStatus? status = null, Guid? assignmentId = null, Guid? studentId = null, string? search = null)
    {
        (page, pageSize) = PagingDefaults.Clamp(page, pageSize);

        var query = _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .AsQueryable();

        if (status is not null)
        {
            query = query.Where(s => s.Status == status);
        }
        if (assignmentId is not null)
        {
            query = query.Where(s => s.AssignmentId == assignmentId);
        }
        if (studentId is not null)
        {
            query = query.Where(s => s.StudentId == studentId);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s =>
                s.Student!.FullName.ToLower().Contains(term) ||
                s.Assignment!.Title.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();
        var submissions = await query
            .OrderByDescending(s => s.SubmittedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new PagedResult<SubmissionResponse>(
            submissions.Select(SubmissionResponseMapper.Map).ToList(), page, pageSize, totalCount));
    }
}
