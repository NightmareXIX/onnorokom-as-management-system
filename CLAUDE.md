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
- [x] **Phase 2** — Auth Backend — done 2026-08-14. `Services/TokenService.cs` issues HS256 JWTs
  (claims: `sub`, `jti`, email, name, role — role uses `ClaimTypes.Role` so `[Authorize(Roles=...)]`
  works out of the box). `Controllers/AuthController.cs`: `POST /api/auth/login` (`[AllowAnonymous]`,
  verifies via `PasswordHasher<User>.VerifyHashedPassword`, returns `ProblemDetails` 401 on bad
  email/password/inactive user) and `GET /api/auth/me` (reads `sub`/`NameIdentifier` claim, 401 if
  missing/invalid). `Program.cs` wires JWT bearer auth + a default/fallback authorization policy
  requiring an authenticated user, so every endpoint needs a token unless `[AllowAnonymous]`.
  Swagger has a `Bearer` HTTP security scheme registered globally (padlock + global `security`
  requirement in swagger.json) so protected endpoints are testable directly from Swagger UI.
  `Jwt__*` settings added to `appsettings.json` (empty placeholders) and
  `appsettings.Development.json` (real dev-only secret, gitignored). Verified end-to-end via curl
  against the running API + Docker Postgres: all three demo accounts log in and `GET /me` returns
  the correct role/profile; wrong password → 401 `ProblemDetails`; no token on `/me` → 401.
  - Bug hit and fixed: `[property: Required]` on a C# record's primary-constructor parameter is
    silently ignored by ASP.NET Core's model validation (it throws `InvalidOperationException` at
    request time) — DataAnnotations on positional record parameters must target the parameter
    directly (`[Required] string Email`, no `property:` prefix), not the generated property.
- [x] **Phase 3** — Core Backend API (MVP slice) — done 2026-08-14. `Controllers/AssignmentsController.cs`
  (`POST /api/assignments` Teacher-only, forces `Status=Published` and takes `TeacherId` from the
  JWT not the body; `GET /api/assignments` role-aware — Teacher: own, Student: own `ClassId`,
  Admin: unfiltered; `GET /api/assignments/{id}` open to any authenticated role) and
  `Controllers/SubmissionsController.cs` (`POST /api/assignments/{id}/submissions` Student-only,
  403 if the assignment's `ClassId` doesn't match the student's; `GET
  /api/assignments/{id}/submissions` and `PUT /api/submissions/{id}/grade` both Teacher-only with
  an ownership check — 403 if `Assignment.TeacherId != callingUserId`; `GET /api/submissions/me`
  Student-only). Added `Extensions/ClaimsPrincipalExtensions.cs` (`GetUserId()`) shared by all
  three controllers, and refactored `AuthController.Me` to use it instead of duplicating the claim
  parse. DTOs for both request/response shapes live in `DTOs/AssignmentDtos.cs` /
  `DTOs/SubmissionDtos.cs` — no entities are exposed directly.
  - Deliberately out of scope per the plan (deferred to Phase 5): deadline enforcement, resubmission
    rules, marks-bounds validation, Draft/Publish toggle. `POST /assignments` always creates
    `Published`; grading accepts any int for `Marks` today.
  - Verified the full happy path end-to-end via curl against the running API + Docker Postgres:
    teacher creates → student (same class) sees + submits → teacher sees + grades → student sees
    marks/feedback. Also verified negative cases: Student hitting `POST /assignments` → 403;
    Admin's `GET /assignments` is unfiltered; Student submitting to a different class's assignment
    → 403. Test data created during verification was deleted afterward so the DB is back to the
    Phase 1 seed-only state.
- [x] **Phase 4** — Frontend MVP ⭐ first submittable checkpoint — done 2026-08-14. `lib/api.ts`
  (axios instance + auth-header interceptor + `getStoredAuth`/`setStoredAuth` as the single
  localStorage source of truth), `lib/auth-context.tsx` (`AuthProvider`/`useAuth`,
  `login()`/`logout()`), `lib/types.ts` (DTO mirror), `lib/format.ts`, `components/RoleGuard.tsx`
  (layout-level redirect-to-`/login`-or-own-home guard), `components/AppHeader.tsx`. Pages: `/login`
  (react-hook-form + zod), `/teacher` (list + New Assignment form with class/subject dropdowns),
  `/teacher/assignments/[id]` (submissions + inline grade form), `/student` (own-class list),
  `/student/assignments/[id]` (detail + submit-once textarea, read-only once a submission exists),
  `/student/submissions` (marks/feedback), `/admin` (placeholder stub — full module is Phase 6, but
  login/routing for the Admin role work end to end). Root `/` redirects by auth state.
  - Two backend additions were needed to unblock this phase and got folded in here rather than
    waiting for their nominally later phase: **CORS** (`Program.cs` — `Cors:AllowedOrigins` config,
    defaults to `http://localhost:3000`) since nothing in Phases 2–3 had a browser client yet, and
    **`GET /api/classes` / `GET /api/subjects`** (`ClassesController`, `SubjectsController` — open
    to any authenticated role, per BUILD_PLAN Section 4's "Shared" API surface) since the New
    Assignment form's dropdowns need them and Phase 3 never built them.
  - `frontend/.env.local` (gitignored) points `NEXT_PUBLIC_API_URL` at `http://localhost:5080/api`
    — matches how the backend was run manually during this session (`dotnet run --urls
    http://localhost:5080`), not the `launchSettings.json` default (`5287`). Whoever runs this next
    should pick one consistently; Phase 10's README should state it explicitly.
  - **Next.js 16 breaking change, exactly as `frontend/AGENTS.md` warned:** `eslint-config-next`
    now enables React Compiler lint rules, including `react-hooks/set-state-in-effect` as a hard
    error — it flags not just synchronous `setState` before any `await` in an effect, but *any*
    `useCallback`-defined loader function called from an effect if that function calls `setState`
    anywhere in its body, even after an `await`. Fixed by (a) restructuring page-level data-fetch
    effects to drop the redundant synchronous `setLoading(true)/setError(null)` resets at the top
    (the `useState` initial values already cover first mount) so all state updates happen after the
    `await`, and (b) for the handful of cases the rule still flagged (shared loader functions also
    reused by event handlers, and the one genuinely-synchronous localStorage read in
    `auth-context.tsx`'s mount effect — which can't be moved past an `await` and can't safely move
    into a `useState` lazy initializer either, since that would read `window.localStorage` during
    the client's hydration render while the server render saw `undefined`, causing a hydration
    mismatch) adding a targeted `// eslint-disable-next-line react-hooks/set-state-in-effect` with a
    comment explaining why. `npm run lint` and `npm run build` are both clean.
  - Verified with a real headless-Chromium session (Playwright, installed ad hoc into the scratch
    dir — not added to `package.json`) rather than just curl: two parallel logged-in sessions
    (teacher + student) ran the full happy path end to end — create → see → submit → see → grade →
    see marks/feedback — with zero browser console errors on either session. Also checked every
    page at a 375px mobile viewport: no horizontal overflow, no broken layout. Test data created
    during verification was deleted from the DB afterward.
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
