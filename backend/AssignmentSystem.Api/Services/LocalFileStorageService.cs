using Microsoft.AspNetCore.Http;

namespace AssignmentSystem.Api.Services;

/// <summary>Stores submission attachments on local disk under Uploads:StoragePath.</summary>
public class LocalFileStorageService : IFileStorageService
{
    private readonly string _rootPath;

    public LocalFileStorageService(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var configuredPath = configuration["Uploads:StoragePath"] ?? "uploads";
        _rootPath = Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(environment.ContentRootPath, configuredPath);

        Directory.CreateDirectory(_rootPath);
    }

    public async Task<string> SaveAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(file.FileName);
        var storedFileName = $"{Guid.NewGuid()}{extension}";
        var fullPath = Path.Combine(_rootPath, storedFileName);

        await using var stream = new FileStream(fullPath, FileMode.Create, FileAccess.Write);
        await file.CopyToAsync(stream, cancellationToken);

        return storedFileName;
    }

    public Task DeleteAsync(string storedFileName)
    {
        var fullPath = Path.Combine(_rootPath, storedFileName);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
        return Task.CompletedTask;
    }

    public Task<Stream?> OpenReadAsync(string storedFileName)
    {
        var fullPath = Path.Combine(_rootPath, storedFileName);
        if (!File.Exists(fullPath))
        {
            return Task.FromResult<Stream?>(null);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
        return Task.FromResult<Stream?>(stream);
    }
}
