namespace AssignmentSystem.Api.DTOs;

public record PagedResult<T>(List<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => TotalCount == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public static class PagingDefaults
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static (int Page, int PageSize) Clamp(int page, int pageSize) =>
        (page < 1 ? 1 : page,
         pageSize < 1 ? DefaultPageSize : Math.Min(pageSize, MaxPageSize));
}
