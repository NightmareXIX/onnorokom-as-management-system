# Build context is ./backend (the solution root), so the Tests project's
# ProjectReference path (../AssignmentSystem.Api/...) isn't needed here — this
# image only ever builds/publishes the Api project.

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY AssignmentSystem.Api/AssignmentSystem.Api.csproj AssignmentSystem.Api/
RUN dotnet restore AssignmentSystem.Api/AssignmentSystem.Api.csproj

COPY AssignmentSystem.Api/ AssignmentSystem.Api/
RUN dotnet publish AssignmentSystem.Api/AssignmentSystem.Api.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Overridden by docker-compose.yml; kept here so the image also runs standalone.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "AssignmentSystem.Api.dll"]
