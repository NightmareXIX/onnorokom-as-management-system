namespace AssignmentSystem.Api.DTOs;

public record ClassResponse(Guid Id, string Name, string? Description);

public record SubjectResponse(Guid Id, string Name, string? Code);
