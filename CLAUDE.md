# CLAUDE.md

Guidance for Claude Code when working in this repository. Keep this file updated as phases
complete — it's the persistent memory of where the project actually stands, separate from the
static plan in `docs/BUILD_PLAN.md`.

## What this project is

A role-based **Assignment & Submission Management System** — Next.js frontend + ASP.NET Core 8
backend + PostgreSQL — built for the OnnoRokom Projukti Limited recruitment assignment (deadline
2026-08-14). Three roles: Admin (manages users/classes/subjects), Teacher (creates assignments,
grades submissions), Student (submits answers to assignments in their class).

**Full build plan:** [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) — read it in full before starting
any phase. It contains the exact data model, API surface, env var contents, and phase-by-phase
tasks/deliverables/Definition-of-Done. This file summarizes the decisions and tracks progress;
BUILD_PLAN.md is the source of truth for implementation detail.

## How to work in this repo

- **Work through phases in order** (0 → 11). Each phase depends on the one before it. Don't jump
  ahead even if it seems faster.
- **Treat each phase as its own session**: finish it, verify its Definition of Done, commit with
  message `Phase N: <name>`, update the progress tracker below, then stop or move on.
- **Phases 0–4 = the MVP.** If time runs out, Phase 4 + Phase 10 (docs/packaging) is a valid
  submission. Phases 5–10 are still required by the spec, just sequenced after the MVP checkpoint.
- **Phase 11 is genuinely optional** — only touch it if everything else is done early.
- Re-read `docs/BUILD_PLAN.md` Section 6 for the phase you're about to start; don't work from
  memory of it.

## Key design decisions (do not relitigate without discussion)

- A Student belongs to exactly **one Class** at a time (`ClassId` directly on `User`), not a
  many-to-many enrollment table.
- Subjects are a catalog independent of Class; `TeacherAssignment` (Teacher+Subject+Class) is what
  says who teaches what to whom. `Assignment` itself references one `ClassId` + `SubjectId`.
- Submission answers are **plain text**, not file uploads (file upload is optional Phase 11).
- **No public self-registration** — only Admin creates accounts.
- **Late submissions are blocked entirely** (`POST /submissions` → 400 after deadline).
- **Resubmission is opt-in** via `Assignment.AllowResubmission`, and still blocked after deadline
  even when allowed.
- JWT stored client-side; localStorage is acceptable for the MVP, httpOnly cookie migration is a
  stretch goal in Phase 8 (document as a known limitation if not done).
- Every Teacher-scoped action must check **ownership** (`TeacherId == callingUserId`), not just
  role — two teachers must not be able to touch each other's assignments.
- Error responses use ASP.NET Core's built-in `ProblemDetails` — no custom error envelope.

## Tech stack

- **Backend:** ASP.NET Core 8 (controllers, not minimal APIs), EF Core + Npgsql, JWT bearer auth,
  `PasswordHasher<T>` (not full ASP.NET Identity), Serilog, Swashbuckle/Swagger.
- **Frontend:** Next.js (TypeScript, Tailwind, App Router, `src/` dir), axios, react-hook-form +
  zod, jwt-decode.
- **Database:** PostgreSQL 16 (via Docker container `assignment-db` — no local install).
- **Tests:** xUnit + Moq + FluentAssertions + EF Core InMemory, in `AssignmentSystem.Tests`.

## Environment (this machine)

- **.NET SDK:** 8.0.424 — installed 2026-08-14 via `winget install Microsoft.DotNet.SDK.8`. Not
  present before this session. If a fresh shell reports `dotnet` as unrecognized even though it's
  installed, it's a stale PATH in that shell session (machine PATH already has
  `C:\Program Files\dotnet`) — open a new terminal rather than reinstalling.
- **Node:** v22.19.0 / npm 10.9.3 — already present, satisfies the Node 18+ requirement.
- **PostgreSQL:** no local install; run via Docker per BUILD_PLAN.md Section 2
  (`docker run --name assignment-db ...`). Docker Desktop is installed; it was not running at the
  start of this session and was launched — confirm `docker ps` works before Phase 1 (DB) work.
- **Git:** repo already initialized (`main` branch, no commits yet as of 2026-08-14). Git identity
  is configured (user.name/user.email set).

## Progress tracker

Update this checklist as phases complete. One line per phase, plus a one-line note on anything
non-obvious that happened during it.

- [x] **Phase 0** — Environment & Scaffolding — done 2026-08-14. Backend (`AssignmentSystem.sln`,
  `AssignmentSystem.Api`, `AssignmentSystem.Tests`) and frontend (`frontend/`, Next.js 16) both
  scaffolded, build clean, dev servers verified to respond (backend Swagger + frontend both
  HTTP 200). NuGet packages for Npgsql/EFCore.Design/JwtBearer had to be pinned to `8.0.x`
  explicitly — `dotnet add package` without a version defaults to latest (10.x on this machine),
  which isn't compatible with the `net8.0` target. First commit `0fcb4e7`.
- [x] **Phase 1** — Database & Domain Models — done 2026-08-14. All entities/enums under `Models/`,
  `Data/AppDbContext.cs` (Fluent API config: unique `User.Email`, `Assignment`→`Submission` is the
  only `Cascade`, every other FK — including every FK that points at `User` — is `Restrict` to
  avoid multi-cascade-path issues and to match "don't hard-delete users with history"),
  `Data/SeedData.cs` (2 Classes, 3 Subjects, 3 demo users via `PasswordHasher<User>`, 2
  TeacherAssignments, demo student's `ClassId` set). `InitialCreate` migration applied to the
  Docker Postgres container; seed verified via direct `psql` query — 2/3/3/2/0/0 rows across
  Classes/Subjects/Users/TeacherAssignments/Assignments/Submissions (the last two are correctly
  empty — Phase 1's seed list never includes them). Removed the default `WeatherForecast`
  scaffold files since Phase 1 is domain-only, no endpoints yet.
  - NuGet gotcha: `dotnet add package` with no version picks the latest major (10.x on this
    machine) which isn't `net8.0`-compatible — pin explicitly. Also keep
    `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.EntityFrameworkCore.Design`, and
    `Microsoft.EntityFrameworkCore.InMemory` on the *same* EFCore version (currently all `8.0.11`)
    or the Tests project throws MSB3277 assembly-version-conflict warnings at build time.
  - Local dev connection string lives in `appsettings.Development.json` (gitignored, not
    committed); `appsettings.json` only has an empty placeholder. Matches Section 5's env var
    approach without needing dotnet to parse a root `.env` file directly.
- [ ] **Phase 2** — Auth Backend
- [ ] **Phase 3** — Core Backend API (MVP slice)
- [ ] **Phase 4** — Frontend MVP ⭐ first submittable checkpoint
- [ ] **Phase 5** — Business Rules & Validation
- [ ] **Phase 6** — Admin Module
- [ ] **Phase 7** — Unit Tests
- [ ] **Phase 8** — Frontend Polish
- [ ] **Phase 9** — Logging, Error Handling, Swagger
- [ ] **Phase 10** — Documentation & Packaging (required)
- [ ] **Phase 11** — Optional Additions (only if time allows)

## Commands reference (fill in once scaffolded)

```
# Backend (from backend/)
dotnet build
dotnet run --project AssignmentSystem.Api
dotnet ef database update --project AssignmentSystem.Api
dotnet test

# Frontend (from frontend/)
npm run dev
npm run build
```

## Demo credentials (seeded in Phase 1)

```
Admin:   admin@school.com   / Admin@123
Teacher: teacher@school.com / Teacher@123
Student: student@school.com / Student@123
```
