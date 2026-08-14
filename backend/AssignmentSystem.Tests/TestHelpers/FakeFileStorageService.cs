using AssignmentSystem.Api.Services;
using Microsoft.AspNetCore.Http;

namespace AssignmentSystem.Tests.TestHelpers;

/// <summary>In-memory IFileStorageService so upload tests never touch real disk.</summary>
public class FakeFileStorageService : IFileStorageService
{
    private readonly Dictionary<string, byte[]> _files = new();

    public IReadOnlyDictionary<string, byte[]> Files => _files;

    public async Task<string> SaveAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        var storedFileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream, cancellationToken);
        _files[storedFileName] = memoryStream.ToArray();
        return storedFileName;
    }

    public Task DeleteAsync(string storedFileName)
    {
        _files.Remove(storedFileName);
        return Task.CompletedTask;
    }

    public Task<Stream?> OpenReadAsync(string storedFileName)
    {
        if (!_files.TryGetValue(storedFileName, out var bytes))
        {
            return Task.FromResult<Stream?>(null);
        }
        return Task.FromResult<Stream?>(new MemoryStream(bytes));
    }
}
