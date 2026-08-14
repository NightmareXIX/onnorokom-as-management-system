# Assignment & Submission Management System

A role-based assignment and submission management system built for the OnnoRokom Projukti
Limited recruitment project. Three roles — **Admin**, **Teacher**, **Student** — each get a
dedicated dashboard backed by a single ASP.NET Core API with JWT authentication and PostgreSQL
storage.

- **Admin** manages users, classes, subjects, and teacher-subject-class assignments, plus a
  read-only oversight view of every assignment and submission in the system.
- **Teacher** creates and publishes assignments for their own classes, views submissions, and
  grades them with marks + feedback.
- **Student** sees assignments for their own class, submits text answers before the deadline, and
  views their marks/feedback once graded.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8 (MVC controllers), EF Core + Npgsql, JWT bearer auth, `PasswordHasher<T>`, Serilog, Swashbuckle/Swagger |
| Frontend | Next.js 16 (TypeScript, App Router, `src/` dir), Tailwind CSS, axios, react-hook-form + zod |
| Database | PostgreSQL 16 (Docker) |
| Tests | xUnit + FluentAssertions + EF Core InMemory, 70 tests in `AssignmentSystem.Tests` |

## Project Structure

```
repo/
  backend/
    AssignmentSystem.sln
    AssignmentSystem.Api/
      Controllers/          # Auth, Assignments, Submissions, Classes, Subjects, Controllers/Admin/*
      Models/                # Entities + enums
      DTOs/                  # Request/response records (entities are never exposed directly)
      Data/                  # AppDbContext, SeedData
      Services/              # TokenService (JWT issuing)
      Middleware/             # Global exception handling, 403-rejection logging
      Migrations/            # EF Core migrations (committed — recreates schema on `dotnet ef database update`)
    AssignmentSystem.Tests/
      AuthorizationTests/    # Ownership + role-based 403 tests
      BusinessRuleTests/     # Deadline, resubmission, marks-bounds, visibility tests
      SubmissionWorkflowTests/ # End-to-end submit -> grade flow tests
  frontend/
    src/
      app/
        login/               # /login
        admin/                # /admin, /admin/classes, /admin/subjects, /admin/teacher-assignments
        teacher/              # /teacher, /teacher/assignments/[id]
        student/              # /student, /student/assignments/[id], /student/submissions
      components/             # RoleGuard, AppHeader, ui/ kit (Button, form fields, toasts, dialogs...)
      lib/                    # api client, auth context, zod schemas, types
  docs/
    BUILD_PLAN.md            # Full data model, API surface, and phase-by-phase build plan
  docker-compose.yml          # Whole stack (Postgres + API + frontend) — `docker compose up --build`
  .env.example
  README.md
```

## Assumptions

These are explicit, reasonable simplifications of an ambiguous spec — not shortcuts on required
features:

- A **Student belongs to exactly one Class at a time** (`ClassId` directly on `User`), not a
  many-to-many enrollment table — the spec only ever refers to "their class" (singular).
- **Subjects are a catalog independent of Class.** A `TeacherAssignment` join table
  (Teacher + Subject + Class) says who teaches what to whom; an `Assignment` references one
  `ClassId` + `SubjectId` pair.
- **Submission answers are plain text**, optionally supplemented by a single attached file (PDF,
  Office docs, images, zip, or txt — up to 10 MB by default, both configurable via
  `Uploads:MaxSizeBytes`/`Uploads:AllowedExtensions`). The text answer itself remains required.
- **No public self-registration** — only Admin creates Teacher/Student/Admin accounts.
- **Late submissions are blocked entirely** — `POST /submissions` returns 400 once
  `Assignment.Deadline` passes.
- **Resubmission is opt-in per assignment** via `Assignment.AllowResubmission`, and is still
  blocked after the deadline even when allowed.

## Known Limitations

- **JWT is stored in `localStorage`**, not an httpOnly cookie. This is a documented XSS-exposure
  tradeoff (see BUILD_PLAN.md Section 1 / Phase 8) — moving it to a cookie would require routing
  every API call through a Next.js route-handler proxy, which was judged too risky to retrofit
  this late against a working demo path.
- **Submission attachments are stored on local disk** (or a Docker named volume when run via
  Compose), not object storage (S3-style) — fine for this project's scope, but wouldn't survive a
  horizontally-scaled/multi-instance deployment without a shared volume or bucket.
- **No virus/malware scanning of uploaded files** — validation is limited to file extension and
  size checks (both server- and client-side).
- **No pagination** on assignment/submission lists (fine at demo data volumes; listed as an
  optional Phase 11 improvement).

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/) (developed/tested on Node 22)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — required for the Docker
  Compose quick start below, or just for running PostgreSQL if you set up the backend/frontend
  directly (a local PostgreSQL 14+ install works too in that case)
- Git

## Quick Start — Docker Compose

The fastest way to run the whole stack (Postgres + API + frontend) — no local .NET/Node/Postgres
setup required, just Docker:

```bash
docker compose up --build
```

Then open **http://localhost:3000** and log in with any [demo credential](#demo-credentials) set.
The API is at **http://localhost:5080** (Swagger at `/swagger`), Postgres at `localhost:5432`.
Schema + seed data are created automatically on first startup, same as running the API directly —
no manual migration step.

Defaults (all overridable via a root `.env` file or shell env vars — see `docker-compose.yml` for
the full list): `DB_PORT=5432`, `API_PORT=5080`, `FRONTEND_PORT=3000`,
`POSTGRES_PASSWORD=devpassword`, `JWT_SECRET=<a placeholder — override for anything beyond local
demo use>`. Because `NEXT_PUBLIC_API_URL` is compiled into the frontend's client bundle at *build*
time (not read at container start), changing `API_PORT` requires `docker compose up --build`
again, not just a restart.

This path is self-contained and independent of the manual `docker run assignment-db` step below —
don't run both against the same host ports at once. To stop and remove everything (including the
Postgres data volume): `docker compose down -v`.

If you'd rather run each piece directly (e.g. for backend/frontend hot-reload during development),
follow "Setup — Backend" and "Setup — Frontend" below instead.

## Setup — Backend

1. **Start PostgreSQL in Docker:**

   ```bash
   docker run --name assignment-db -e POSTGRES_PASSWORD=devpassword \
     -e POSTGRES_DB=assignment_system -p 5432:5432 -d postgres:16
   ```

   (If you already have Postgres running locally instead, just make sure a database named
   `assignment_system` exists and update the connection string in step 2 accordingly.)

2. **Configure secrets.** The API reads `ConnectionStrings:DefaultConnection` and `Jwt:Secret`
   from config, and neither is committed (see `.env.example` at the repo root for the values).
   Create `backend/AssignmentSystem.Api/appsettings.Development.json` (gitignored, never
   committed) with:

   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Port=5432;Database=assignment_system;Username=postgres;Password=devpassword"
     },
     "Jwt": {
       "Secret": "replace-with-a-random-32-plus-character-secret",
       "Issuer": "AssignmentSystemApi",
       "Audience": "AssignmentSystemClient",
       "ExpiryMinutes": 60
     }
   }
   ```

   (Equivalently, you can export the same values as real environment variables using the
   double-underscore names in `.env.example` — ASP.NET Core picks those up automatically. The
   JSON file is simpler for local development.)

3. **Run the API:**

   ```bash
   cd backend/AssignmentSystem.Api
   dotnet run
   ```

   No separate migration step is required — `Program.cs` calls `context.Database.Migrate()` and
   seeds demo data on every startup, so the **first run alone creates the schema and inserts the
   demo accounts** (it's a no-op on every run after that, since seeding checks
   `if (!context.Users.Any())` first). If you'd rather apply the schema without starting the app,
   `dotnet ef database update` from the same directory does just the migration step.

   The API listens on **http://localhost:5080** (set in `Properties/launchSettings.json`) with
   Swagger UI at **http://localhost:5080/swagger** — open it and use the "Authorize" button with a
   JWT from `POST /api/auth/login` to try protected endpoints directly.

## Setup — Frontend

1. **Configure the API URL.** Create `frontend/.env.local` (gitignored) with:

   ```
   NEXT_PUBLIC_API_URL=http://localhost:5080/api
   ```

2. **Install and run:**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open **http://localhost:3000** — you'll land on `/login`.

## Demo Credentials

Seeded automatically on first backend startup:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@school.com` | `Admin@123` |
| Teacher | `teacher@school.com` | `Teacher@123` |
| Student | `student@school.com` | `Student@123` |

## Running Tests

```bash
cd backend
dotnet test
```

70 tests across three folders, all running against an in-memory EF Core database (no Postgres
needed to run them):

- `BusinessRuleTests/` — deadline enforcement, resubmission rules, marks-bounds validation,
  assignment visibility by role/status.
- `AuthorizationTests/` — teacher ownership checks, role-based 403s, login rejection cases.
- `SubmissionWorkflowTests/` — end-to-end submit → grade → view-marks flows.

## Environment Variables

See `.env.example` at the repo root for the full reference list (backend, double-underscore
style, and the frontend's `NEXT_PUBLIC_API_URL`). Backend secrets go into
`appsettings.Development.json` or real environment variables as described in "Setup — Backend"
above; nothing in `.env.example` itself is a real secret — the connection string password is the
same Docker-local placeholder used throughout this README and `docs/BUILD_PLAN.md`.

## Key Design Decisions

- Every Teacher-scoped action checks **ownership** (`Assignment.TeacherId == callingUserId`), not
  just role — two teachers cannot touch each other's assignments or submissions.
- Deactivating a user (`DELETE /api/admin/users/{id}`) sets `IsActive = false` rather than
  hard-deleting — accounts with submission/assignment history are never removed from the
  database.
- Error responses use ASP.NET Core's built-in `ProblemDetails` (RFC 7807) — no custom error
  envelope. Unhandled exceptions are caught by a global middleware and returned as a `ProblemDetails`
  500 with a `traceId`, never a raw stack trace; the same trace id is written to the server log.
- Logging (Serilog, console + rolling daily file under `backend/AssignmentSystem.Api/Logs/`,
  gitignored) covers every failed login, every 403 authorization rejection, and every unhandled
  exception.

## API Overview

Full endpoint-by-endpoint reference: `docs/BUILD_PLAN.md` Section 4, or Swagger UI once the API
is running. Broad strokes:

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/assignments`, `PATCH /api/assignments/{id}/publish`
- `POST /api/assignments/{id}/submissions`, `PUT /api/submissions/{id}` (both `multipart/form-data`
  — text `Content` plus an optional attached file), `GET /api/submissions/{id}/file` (download,
  owner Student/Teacher or Admin only), `GET /api/submissions/me`,
  `GET /api/assignments/{id}/submissions`, `PUT /api/submissions/{id}/grade`,
  `PATCH /api/submissions/{id}/status`
- `GET/POST/PUT/DELETE /api/admin/users`, `.../classes`, `.../subjects`,
  `GET/POST/DELETE /api/admin/teacher-assignments`, read-only
  `GET /api/admin/assignments` / `GET /api/admin/submissions`
- `GET /api/classes`, `GET /api/subjects` (shared, read-only, any authenticated role)

All role/ownership checks are enforced server-side — the frontend's route guards are a UX
convenience, not the security boundary.
