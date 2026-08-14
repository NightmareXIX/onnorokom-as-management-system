using System.Text;
using Microsoft.AspNetCore.Http;

namespace AssignmentSystem.Tests.TestHelpers;

public static class TestFormFile
{
    public static IFormFile Create(
        string fileName = "answer.pdf",
        string contentType = "application/pdf",
        long sizeBytes = 1024)
    {
        var bytes = new byte[sizeBytes];
        Encoding.UTF8.GetBytes("test file content").CopyTo(bytes, 0);
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "File", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }
}
