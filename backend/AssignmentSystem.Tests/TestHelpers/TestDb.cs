using AssignmentSystem.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Tests.TestHelpers;

public static class TestDb
{
    /// <summary>Fresh in-memory AppDbContext, isolated per call via a unique database name.</summary>
    public static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }
}
