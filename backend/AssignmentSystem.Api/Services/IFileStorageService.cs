using Microsoft.AspNetCore.Http;

namespace AssignmentSystem.Api.Services;

public interface IFileStorageService
{
    /// <summary>Saves the file to storage and returns the generated stored file name.</summary>
    Task<string> SaveAsync(IFormFile file, CancellationToken cancellationToken = default);

    Task DeleteAsync(string storedFileName);

    /// <summary>Opens a read stream for a previously stored file. Returns null if it doesn't exist.</summary>
    Task<Stream?> OpenReadAsync(string storedFileName);
}
