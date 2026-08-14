using Microsoft.Extensions.Configuration;

namespace AssignmentSystem.Tests.TestHelpers;

public static class TestConfig
{
    public static IConfiguration Uploads { get; } = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Uploads:MaxSizeBytes"] = "10485760",
            ["Uploads:AllowedExtensions"] = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.png,.jpg,.jpeg,.gif"
        })
        .Build();
}
