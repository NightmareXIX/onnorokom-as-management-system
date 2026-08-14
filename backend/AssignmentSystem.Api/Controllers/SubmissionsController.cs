using AssignmentSystem.Api.Data;
using AssignmentSystem.Api.DTOs;
using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Api.Models;
using AssignmentSystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api")]
public class SubmissionsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<SubmissionsController> _logger;
    private readonly IFileStorageService _fileStorage;
    private readonly IConfiguration _configuration;
    private readonly NotificationService _notifications;

    public SubmissionsController(
        AppDbContext context,
        ILogger<SubmissionsController> logger,
        IFileStorageService fileStorage,
        IConfiguration configuration,
        NotificationService notifications)
    {
        _context = context;
        _logger = logger;
        _fileStorage = fileStorage;
        _configuration = configuration;
        _notifications = notifications;
    }

    /// <summary>Submits an answer to an assignment (Student only), with an optional file attachment. Blocked after the deadline or if already submitted.</summary>
    [HttpPost("assignments/{assignmentId:guid}/submissions")]
    [Authorize(Roles = "Student")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<SubmissionResponse>> Create(Guid assignmentId, [FromForm] CreateSubmissionRequest request)
    {
        var studentId = User.GetUserId();

        var assignment = await _context.Assignments.FindAsync(assignmentId);
        if (assignment is null)
        {
            return NotFound();
        }

        var student = await _context.Users.FindAsync(studentId);
        if (student?.ClassId is null || assignment.ClassId != student.ClassId)
        {
            return Forbidden("This assignment is not in your class.");
        }

        if (assignment.Status != AssignmentStatus.Published)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "This assignment is not open for submissions.");
        }

        if (DateTime.UtcNow > assignment.Deadline)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "The deadline for this assignment has passed.");
        }

        var alreadySubmitted = await _context.Submissions
            .AnyAsync(s => s.AssignmentId == assignmentId && s.StudentId == studentId);
        if (alreadySubmitted)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "You have already submitted this assignment. Use update to resubmit.");
        }

        var fileError = ValidateFile(request.File);
        if (fileError is not null)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: fileError);
        }

        var submission = new Submission
        {
            Id = Guid.NewGuid(),
            AssignmentId = assignmentId,
            StudentId = studentId,
            Content = request.Content,
            Status = SubmissionStatus.Submitted,
            SubmittedAt = DateTime.UtcNow
        };

        if (HasFile(request.File))
        {
            await SaveFileAsync(submission, request.File!);
        }

        _context.Submissions.Add(submission);
        _notifications.NotifyNewSubmission(assignment.TeacherId, submission.Id, assignmentId, assignment.Title, student.FullName);
        await _context.SaveChangesAsync();

        var response = await LoadResponseAsync(submission.Id);
        return CreatedAtAction(nameof(GetForAssignment), new { assignmentId }, response);
    }

    /// <summary>Updates (resubmits) an existing submission (Student, owner only), optionally replacing the attached file. Blocked if resubmission isn't allowed or the deadline has passed.</summary>
    [HttpPut("submissions/{id:guid}")]
    [Authorize(Roles = "Student")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<SubmissionResponse>> Update(Guid id, [FromForm] UpdateSubmissionRequest request)
    {
        var studentId = User.GetUserId();

        var submission = await _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (submission is null)
        {
            return NotFound();
        }

        if (submission.StudentId != studentId)
        {
            return Forbidden("You do not own this submission.");
        }

        if (!submission.Assignment!.AllowResubmission)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Resubmission is not allowed for this assignment.");
        }

        if (DateTime.UtcNow > submission.Assignment.Deadline)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "The deadline for this assignment has passed.");
        }

        var fileError = ValidateFile(request.File);
        if (fileError is not null)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: fileError);
        }

        submission.Content = request.Content;
        submission.UpdatedAt = DateTime.UtcNow;
        submission.Status = SubmissionStatus.Submitted;
        submission.Marks = null;
        submission.Feedback = null;
        submission.GradedAt = null;
        submission.GradedByTeacherId = null;

        if (HasFile(request.File))
        {
            if (submission.StoredFileName is not null)
            {
                await _fileStorage.DeleteAsync(submission.StoredFileName);
            }
            await SaveFileAsync(submission, request.File!);
        }

        _notifications.NotifyNewSubmission(
            submission.Assignment.TeacherId, submission.Id, submission.AssignmentId,
            submission.Assignment.Title, submission.Student!.FullName);
        await _context.SaveChangesAsync();

        return Ok(SubmissionResponseMapper.Map(submission));
    }

    /// <summary>Downloads a submission's attached file (Admin, the owning Student, or the owning Teacher).</summary>
    [HttpGet("submissions/{id:guid}/file")]
    public async Task<IActionResult> DownloadFile(Guid id)
    {
        var submission = await _context.Submissions
            .Include(s => s.Assignment)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (submission is null || submission.StoredFileName is null)
        {
            return NotFound();
        }

        var role = User.GetRole();
        var userId = User.GetUserId();
        var isOwner = role == "Admin"
            || (role == "Student" && submission.StudentId == userId)
            || (role == "Teacher" && submission.Assignment!.TeacherId == userId);

        if (!isOwner)
        {
            return Forbidden("You do not have access to this submission's file.");
        }

        var stream = await _fileStorage.OpenReadAsync(submission.StoredFileName);
        if (stream is null)
        {
            return NotFound();
        }

        var contentType = submission.FileContentType ?? "application/octet-stream";
        return File(stream, contentType, submission.FileName ?? submission.StoredFileName);
    }

    /// <summary>Lists all submissions for an assignment (Teacher, owner only). Supports paging and status/search (student name) filters.</summary>
    [HttpGet("assignments/{assignmentId:guid}/submissions")]
    [Authorize(Roles = "Teacher")]
    public async Task<ActionResult<PagedResult<SubmissionResponse>>> GetForAssignment(
        Guid assignmentId, int page = 1, int pageSize = 20,
        SubmissionStatus? status = null, string? search = null)
    {
        var teacherId = User.GetUserId();

        var assignment = await _context.Assignments.FindAsync(assignmentId);
        if (assignment is null)
        {
            return NotFound();
        }

        if (assignment.TeacherId != teacherId)
        {
            return Forbidden("You do not own this assignment.");
        }

        (page, pageSize) = PagingDefaults.Clamp(page, pageSize);

        var query = _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .Where(s => s.AssignmentId == assignmentId)
            .AsQueryable();

        if (status is not null)
        {
            query = query.Where(s => s.Status == status);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s => s.Student!.FullName.ToLower().Contains(term));
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

    /// <summary>Grades a submission with marks and feedback (Teacher, owner only). Marks must be within [0, MaxMarks].</summary>
    [HttpPut("submissions/{id:guid}/grade")]
    [Authorize(Roles = "Teacher")]
    public async Task<ActionResult<SubmissionResponse>> Grade(Guid id, GradeSubmissionRequest request)
    {
        var teacherId = User.GetUserId();

        var submission = await _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (submission is null)
        {
            return NotFound();
        }

        if (submission.Assignment!.TeacherId != teacherId)
        {
            return Forbidden("You do not own this assignment.");
        }

        if (request.Marks < 0 || request.Marks > submission.Assignment.MaxMarks)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: $"Marks must be between 0 and {submission.Assignment.MaxMarks}.");
        }

        submission.Marks = request.Marks;
        submission.Feedback = request.Feedback;
        submission.Status = SubmissionStatus.Graded;
        submission.GradedAt = DateTime.UtcNow;
        submission.GradedByTeacherId = teacherId;

        _notifications.NotifySubmissionGraded(
            submission.StudentId, submission.Id, submission.Assignment.Title,
            request.Marks, submission.Assignment.MaxMarks);
        await _context.SaveChangesAsync();

        return Ok(SubmissionResponseMapper.Map(submission));
    }

    /// <summary>Transitions a submission's status, e.g. Graded to ReturnedForRevision (Teacher, owner only).</summary>
    [HttpPatch("submissions/{id:guid}/status")]
    [Authorize(Roles = "Teacher")]
    public async Task<ActionResult<SubmissionResponse>> UpdateStatus(Guid id, UpdateSubmissionStatusRequest request)
    {
        var teacherId = User.GetUserId();

        var submission = await _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (submission is null)
        {
            return NotFound();
        }

        if (submission.Assignment!.TeacherId != teacherId)
        {
            return Forbidden("You do not own this assignment.");
        }

        submission.Status = request.Status;

        if (request.Status == SubmissionStatus.ReturnedForRevision)
        {
            _notifications.NotifySubmissionReturnedForRevision(
                submission.StudentId, submission.Id, submission.AssignmentId, submission.Assignment.Title);
        }

        await _context.SaveChangesAsync();

        return Ok(SubmissionResponseMapper.Map(submission));
    }

    /// <summary>Lists the calling student's own submissions with status, marks, and feedback. Supports paging and status/assignmentId/search (assignment title) filters.</summary>
    [HttpGet("submissions/me")]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<PagedResult<SubmissionResponse>>> GetMine(
        int page = 1, int pageSize = 20,
        SubmissionStatus? status = null, Guid? assignmentId = null, string? search = null)
    {
        var studentId = User.GetUserId();

        (page, pageSize) = PagingDefaults.Clamp(page, pageSize);

        var query = _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .Where(s => s.StudentId == studentId)
            .AsQueryable();

        if (status is not null)
        {
            query = query.Where(s => s.Status == status);
        }
        if (assignmentId is not null)
        {
            query = query.Where(s => s.AssignmentId == assignmentId);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s => s.Assignment!.Title.ToLower().Contains(term));
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

    private static bool HasFile(IFormFile? file) => file is not null && file.Length > 0;

    private string? ValidateFile(IFormFile? file)
    {
        if (!HasFile(file))
        {
            return null;
        }

        var maxSizeBytes = long.TryParse(_configuration["Uploads:MaxSizeBytes"], out var configuredMax)
            ? configuredMax
            : 10 * 1024 * 1024;
        if (file!.Length > maxSizeBytes)
        {
            return $"The attached file exceeds the maximum size of {maxSizeBytes / (1024 * 1024)} MB.";
        }

        var allowedExtensions = (_configuration["Uploads:AllowedExtensions"] ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(extension) || !allowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
        {
            return $"That file type isn't allowed. Allowed types: {string.Join(", ", allowedExtensions)}.";
        }

        return null;
    }

    private async Task SaveFileAsync(Submission submission, IFormFile file)
    {
        submission.StoredFileName = await _fileStorage.SaveAsync(file);
        submission.FileName = Path.GetFileName(file.FileName);
        submission.FileContentType = file.ContentType;
        submission.FileSizeBytes = file.Length;
    }

    private ObjectResult Forbidden(string title)
    {
        _logger.LogWarning(
            "Authorization rejected (403): user {UserId} -> {Title} ({Method} {Path})",
            User.GetUserId(), title, Request.Method, Request.Path);
        return Problem(statusCode: StatusCodes.Status403Forbidden, title: title);
    }

    private async Task<SubmissionResponse> LoadResponseAsync(Guid id)
    {
        var submission = await _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .FirstAsync(s => s.Id == id);

        return SubmissionResponseMapper.Map(submission);
    }
}
