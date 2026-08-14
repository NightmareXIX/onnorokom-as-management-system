# Assignment & Submission Management System — Build Plan

**Purpose of this document:** This is a complete, self-contained build plan for a role-based
Assignment & Submission Management System (Next.js + ASP.NET Core + PostgreSQL), written for
Claude Code to execute phase-by-phase. Original spec: OnnoRokom Projukti Limited recruitment
project, deadline 14 August 2026.

## How to use this plan

1. Work through phases **in order**. Do not skip ahead to later phases before earlier ones are
   working — each phase depends on the one before it.
2. After finishing each phase, run its "Definition of Done" checks, `git add -A && git commit -m
   "Phase N: <name>"`, and update the README's progress notes before moving on.
3. **Phases 0–4 produce a fully working, submittable MVP.** If you run out of time, stop after
   Phase 4, finish Phase 10 (README + .env.example + demo credentials), and submit that. It will
   satisfy the core spec even if the admin module and full test suite aren't done.
4. Phases 5–10 are **not optional** in the original spec (admin module, business rules, tests,
   docs are all explicitly required) — they're just sequenced *after* the MVP so there's always a
   working checkpoint.
5. Phase 11 is genuinely optional (the spec says so) — only touch it if everything else is done
   with time to spare.
6. Do not batch multiple phases into one context window if avoidable — treat each phase as its
   own working session, verify it builds/runs, then move on.

---

## 1. Assumptions & Design Decisions

State these explicitly in the README's "Assumptions" section — they're reasonable simplifications
of an ambiguous spec, not shortcuts on the required features.

- **A student belongs to exactly one Class at a time** (a `ClassId` field directly on the Student
  user), not a many-to-many enrollment table. Simpler, and the spec only ever says "their
  class/course" (singular).
- **Subjects are a catalog independent of Class** (e.g. "Mathematics" exists once), and a
  `TeacherAssignment` join table (`TeacherId` + `SubjectId` + `ClassId`) is what actually says
  "this teacher teaches this subject to this class." An `Assignment` references a specific
  `ClassId` + `SubjectId` pair.
- **Submission answers are plain text**, not file uploads. File upload is listed as an optional
  add-on (Phase 11) if time allows.
- **No public self-registration.** Only Admin creates Teacher/Student/Admin accounts. This matches
  "Admin: Manage users" and avoids scope creep (email verification etc.).
- **Late submissions are blocked entirely** — once `Assignment.Deadline` passes, `POST
  /submissions` returns 400. This is the simplest defensible reading of "Submit an answer" +
  "View assignment details and deadline."
- **Resubmission is opt-in per assignment** via `Assignment.AllowResubmission` (bool), and even
  when allowed, updates are blocked after the deadline — matches "Update a submission before the
  deadline, if allowed" exactly.
- **JWT stored client-side** (httpOnly cookie preferred over localStorage if time allows in Phase
  8; localStorage is fine for the MVP checkpoint — note this as a known limitation in the README
  if you don't get to harden it).

---

## 2. Tech Stack & Setup Commands

Run these **before** writing any application code.

### Prerequisites (check/install first)
```bash
dotnet --version        # need .NET 8 SDK
node --version           # need Node 18+
psql --version           # PostgreSQL 14+, or use Docker (see below)
```

If PostgreSQL isn't installed locally, run it in Docker instead of installing it:
```bash
docker run --name assignment-db -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=assignment_system -p 5432:5432 -d postgres:16
```

### Backend project scaffolding
```bash
mkdir -p backend && cd backend
dotnet new sln -n AssignmentSystem

dotnet new webapi -n AssignmentSystem.Api -controllers
dotnet new xunit -n AssignmentSystem.Tests

dotnet sln add AssignmentSystem.Api/AssignmentSystem.Api.csproj
dotnet sln add AssignmentSystem.Tests/AssignmentSystem.Tests.csproj

cd AssignmentSystem.Tests
dotnet add reference ../AssignmentSystem.Api/AssignmentSystem.Api.csproj
cd ..
```

`-controllers` gives standard MVC controllers instead of minimal APIs — easier to unit test and
more familiar for evaluators skimming the code.

### Backend packages
```bash
cd AssignmentSystem.Api

dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add package Microsoft.AspNetCore.Identity          # for PasswordHasher<T> only, not full Identity
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
dotnet add package Swashbuckle.AspNetCore                 # usually already included by the template — check csproj first

cd ../AssignmentSystem.Tests
dotnet add package Moq
dotnet add package FluentAssertions
dotnet add package Microsoft.EntityFrameworkCore.InMemory

cd ..
dotnet tool install --global dotnet-ef   # skip if already installed
```

### Frontend scaffolding
```bash
cd .. # back to repo root
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd frontend
npm install axios react-hook-form zod @hookform/resolvers jwt-decode
```

### Repo structure (target)
```
repo/
  backend/
    AssignmentSystem.sln
    AssignmentSystem.Api/
      Controllers/
      Models/            # entities
      DTOs/
      Data/              # DbContext, migrations, seed
      Services/          # auth, business logic
      Program.cs
    AssignmentSystem.Tests/
      AuthorizationTests/
      BusinessRuleTests/
  frontend/
    src/
      app/
        (auth)/login
        admin/
        teacher/
        student/
      components/
      lib/               # api client, auth context
  README.md
  .env.example
  docker-compose.yml     # optional, Phase 11
```

---

## 3. Data Model

### Enums
```csharp
public enum UserRole { Admin, Teacher, Student }
public enum AssignmentStatus { Draft, Published }
public enum SubmissionStatus { Submitted, Graded, ReturnedForRevision }
```

### Entities

**User**
| Field | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| FullName | string | |
| Email | string | unique |
| PasswordHash | string | via `PasswordHasher<User>` |
| Role | UserRole | |
| ClassId | Guid? | only set for Students, FK → Class |
| IsActive | bool | default true |
| CreatedAt | DateTime | |

**Class**
| Field | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| Name | string | e.g. "Class 10 - Section A" |
| Description | string? | |

**Subject**
| Field | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| Name | string | e.g. "Mathematics" |
| Code | string? | |

**TeacherAssignment** (join table: which teacher teaches which subject to which class)
| Field | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| TeacherId | Guid | FK → User (Role=Teacher) |
| SubjectId | Guid | FK → Subject |
| ClassId | Guid | FK → Class |

**Assignment**
| Field | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| Title | string | |
| Description | string | |
| ClassId | Guid | FK |
| SubjectId | Guid | FK |
| TeacherId | Guid | FK, creator |
| Deadline | DateTime | UTC |
| MaxMarks | int | |
| Status | AssignmentStatus | Draft / Published |
| AllowResubmission | bool | |
| CreatedAt | DateTime | |
| UpdatedAt | DateTime? | |

**Submission**
| Field | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| AssignmentId | Guid | FK |
| StudentId | Guid | FK |
| Content | string | text answer |
| Status | SubmissionStatus | |
| Marks | int? | null until graded, must be 0 ≤ Marks ≤ Assignment.MaxMarks |
| Feedback | string? | |
| SubmittedAt | DateTime | |
| UpdatedAt | DateTime? | set on resubmission |
| GradedAt | DateTime? | |
| GradedByTeacherId | Guid? | |

**Relationships:** Class 1→N User(students), Class 1→N Assignment, Subject 1→N Assignment,
Subject 1→N TeacherAssignment, User(Teacher) 1→N TeacherAssignment, User(Teacher) 1→N Assignment,
Assignment 1→N Submission, User(Student) 1→N Submission.

---

## 4. Full API Surface (reference — built incrementally across phases)

**Auth**
- `POST /api/auth/login` → `{ email, password }` → `{ token, role, fullName }`
- `GET /api/auth/me` → current user profile (from JWT)

**Assignments**
- `GET /api/assignments` — role-aware: Teacher sees own, Student sees own-class + Published only, Admin sees all
- `GET /api/assignments/{id}`
- `POST /api/assignments` — Teacher only
- `PUT /api/assignments/{id}` — Teacher (owner) only
- `DELETE /api/assignments/{id}` — Teacher (owner) only
- `PATCH /api/assignments/{id}/publish` — Teacher (owner) only, Draft → Published

**Submissions**
- `POST /api/assignments/{id}/submissions` — Student only, creates submission
- `PUT /api/submissions/{id}` — Student (owner) only, update before deadline if allowed
- `GET /api/submissions/me` — Student, list own submissions with status/marks/feedback
- `GET /api/assignments/{id}/submissions` — Teacher (owner) only, list submissions to grade
- `PUT /api/submissions/{id}/grade` — Teacher only, `{ marks, feedback }`
- `PATCH /api/submissions/{id}/status` — Teacher only, `{ status }`

**Admin**
- `GET/POST/PUT/DELETE /api/admin/users`
- `GET/POST/PUT/DELETE /api/admin/classes`
- `GET/POST/PUT/DELETE /api/admin/subjects`
- `GET/POST/DELETE /api/admin/teacher-assignments`
- `GET /api/admin/assignments` — view all, any status
- `GET /api/admin/submissions` — view all

**Shared (read-only, any authenticated role)**
- `GET /api/classes`
- `GET /api/subjects`

All error responses use ASP.NET Core's built-in `ProblemDetails` shape (don't invent a custom
envelope — it's already RFC-7807-compliant and satisfies "error handling" from the spec).

---

## 5. Environment Variables (`.env.example` content)

Create this at repo root:
```
# --- Backend (ASP.NET Core reads double-underscore env vars automatically) ---
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=assignment_system;Username=postgres;Password=devpassword
Jwt__Secret=replace-with-a-random-32-plus-character-secret
Jwt__Issuer=AssignmentSystemApi
Jwt__Audience=AssignmentSystemClient
Jwt__ExpiryMinutes=60

# --- Frontend (frontend/.env.local) ---
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Demo credentials to seed and list in the README (pick your own passwords, keep them simple):
```
Admin:   admin@school.com   / Admin@123
Teacher: teacher@school.com / Teacher@123
Student: student@school.com / Student@123
```

---

## 6. Build Phases

### Phase 0 — Environment & Scaffolding
**Goal:** Empty-but-running skeleton for both apps.
**Tasks:**
- Run all commands in Section 2.
- `git init`, add a root `.gitignore` (dotnet + node + `.env` + `.env.local`).
- Confirm `dotnet build` succeeds on the backend solution and `npm run dev` starts the frontend.
**Deliverables:**
- `backend/AssignmentSystem.sln`, `backend/AssignmentSystem.Api/` (default template), `backend/AssignmentSystem.Tests/` (referencing Api project)
- `frontend/` — Next.js + TypeScript + Tailwind app skeleton
- Root `.gitignore` (dotnet + node + `.env` + `.env.local`), initialized git repo with first commit
**Definition of Done:** Both projects boot with zero application code, no errors.

### Phase 1 — Database & Domain Models
**Goal:** All entities + DbContext + first migration + seed data, no API endpoints yet.
**Tasks:**
- Create entity classes and enums exactly as in Section 3, under `Models/`.
- Create `AppDbContext` in `Data/` with `DbSet<T>` for every entity, and configure relationships
  with Fluent API (`OnModelCreating`) — cascade rules: deleting an Assignment cascades to its
  Submissions; deleting a User should be restricted, not cascaded (use `DeleteBehavior.Restrict`
  on User FKs to avoid multi-cascade-path errors, which Postgres/EF will otherwise reject).
- Wire the connection string from config in `Program.cs`.
- Write a `Data/SeedData.cs` that runs on startup (`app.Services` scope, `context.Database.Migrate()`
  then check `if (!context.Users.Any())` before inserting) with: 2 Classes, 3 Subjects, the 3 demo
  users (Section 5 credentials, hashed via `PasswordHasher<User>`), 1–2 TeacherAssignments linking
  the demo teacher to a subject+class, and the demo student's `ClassId` set to match.
- `dotnet ef migrations add InitialCreate` then `dotnet ef database update`.
**Deliverables:**
- `Models/` — all entity classes + enums from Section 3
- `Data/AppDbContext.cs` with Fluent API relationship config
- `Data/SeedData.cs`
- `Migrations/InitialCreate` (+ `.Designer.cs`, snapshot)
- A running local Postgres instance with the schema applied and seed rows present
**Definition of Done:** `dotnet ef database update` succeeds against local/Docker Postgres, and
inspecting the DB shows seeded rows in every table.

### Phase 2 — Auth Backend
**Goal:** Login works and issues a role-aware JWT; `[Authorize]` is wired globally.
**Tasks:**
- `AuthController` with `POST /api/auth/login`: verify email exists, verify password via
  `PasswordHasher<User>.VerifyHashedPassword`, issue JWT with claims `sub` (UserId), `role`,
  `email`, `name`, expiry from config.
- `GET /api/auth/me`: read claims from `HttpContext.User`, return profile.
- Configure JWT bearer auth + `AddAuthorization` in `Program.cs`; add `[Authorize]` as the default
  policy so every endpoint requires auth unless explicitly `[AllowAnonymous]` (only `login` should
  be anonymous).
- Add Swagger JWT bearer support (the "Authorize" padlock button) so you can test protected
  endpoints manually without a frontend yet.
**Deliverables:**
- `Controllers/AuthController.cs` (`POST /login`, `GET /me`)
- `Services/TokenService.cs` (or similar) — JWT issuing logic
- JWT bearer config + `AddAuthorization` wired in `Program.cs`, `Jwt__*` settings in config
- Swagger UI showing the "Authorize" padlock and a working bearer-token flow
**Definition of Done:** Via Swagger — log in as each demo user, get a token, paste it into
Swagger's Authorize dialog, and confirm `GET /api/auth/me` returns the right role for each.

### Phase 3 — Core Backend API (MVP slice)
**Goal:** The minimum vertical slice: Teacher creates a Published assignment, Student sees it and
submits, Teacher grades it. Skip Draft/Publish toggle and skip resubmission logic for now —
straight-line happy path only. Skip Admin endpoints for now (Section 3's seed data covers Admin's
job for the MVP checkpoint).
**Tasks:**
- `AssignmentsController`:
  - `POST /api/assignments` (Teacher, `[Authorize(Roles="Teacher")]`) — force `Status=Published`
    for now, set `TeacherId` from the JWT `sub` claim, not from the request body.
  - `GET /api/assignments` — Teacher: `WHERE TeacherId == me`. Student: `WHERE ClassId == my
    ClassId`.
  - `GET /api/assignments/{id}`.
- `SubmissionsController`:
  - `POST /api/assignments/{id}/submissions` (Student) — reject if `id` doesn't belong to
    student's class; set `StudentId` from JWT, `Status=Submitted`.
  - `GET /api/assignments/{id}/submissions` (Teacher, owner only).
  - `PUT /api/submissions/{id}/grade` (Teacher, owner only) — set `Marks`, `Feedback`,
    `Status=Graded`, `GradedAt`, `GradedByTeacherId`.
  - `GET /api/submissions/me` (Student).
- Use DTOs (request/response records) for every endpoint — never expose entities directly, to
  avoid leaking `PasswordHash` etc. and to keep the API contract stable.
**Deliverables:**
- `Controllers/AssignmentsController.cs` (`POST`, `GET` list, `GET` by id)
- `Controllers/SubmissionsController.cs` (`POST` submit, `GET` list-for-assignment, `PUT` grade, `GET /me`)
- `DTOs/` — request/response records for assignments and submissions
- A demonstrable happy path in Swagger (screenshot or note it in your working notes — evaluators will re-test this themselves via Swagger too)
**Definition of Done:** Full happy path testable in Swagger: teacher creates assignment → student
sees + submits → teacher sees submission + grades → student sees marks/feedback.

### Phase 4 — Frontend MVP  ⭐ First submittable checkpoint
**Goal:** Same happy path as Phase 3, but through a browser UI.
**Tasks:**
- `lib/api.ts`: axios instance with base URL from `NEXT_PUBLIC_API_URL`, request interceptor
  attaching `Authorization: Bearer <token>` from storage.
- `lib/auth-context.tsx`: React context holding `{ token, role, fullName }`, persisted to
  localStorage, `login()`/`logout()` methods.
- `/login` page: email+password form (react-hook-form + zod), calls `/api/auth/login`, stores
  token, redirects by role (`/teacher`, `/student`, `/admin`).
- Route guard: a layout-level check per role folder that redirects to `/login` if no token or
  wrong role.
- `/teacher` — list own assignments; a "New Assignment" form (title, description, class dropdown,
  subject dropdown, deadline, max marks) hitting `POST /api/assignments`.
- `/teacher/assignments/[id]` — list submissions for that assignment, inline grade form (marks +
  feedback) hitting `PUT /api/submissions/{id}/grade`.
- `/student` — list own-class assignments; click through to detail + submission textarea hitting
  `POST /api/assignments/{id}/submissions`.
- `/student/submissions` — list own submissions with status/marks/feedback.
- Basic Tailwind styling — doesn't need to be beautiful, needs to be usable and not broken on
  mobile widths (spec says "responsive UI").
**Deliverables:**
- `lib/api.ts`, `lib/auth-context.tsx`
- `/login` page
- `/teacher` (assignment list + create form), `/teacher/assignments/[id]` (submissions + grading)
- `/student` (assignment list), `/student/assignments/[id]` (detail + submit), `/student/submissions` (marks/feedback)
- Route guards on all role folders
- **A fully working, demoable app** — this is the artifact you'd zip up and submit if forced to stop here
**Definition of Done:** In a real browser, log in as teacher and student in two tabs, and complete
the full happy path end to end with no console errors.

> **⭐ Stopping point:** if you're out of time after this phase, go straight to Phase 10, write the
> README/`.env.example`/demo credentials, and submit. It's a working, evaluable app even without
> the admin module, draft/publish, resubmission rules, or the full test suite.

### Phase 5 — Business Rules & Validation
**Goal:** Layer in every rule the MVP skipped, without breaking the happy path.
**Tasks:**
- Deadline enforcement: `POST /submissions` returns 400 if `DateTime.UtcNow > Assignment.Deadline`.
- Resubmission: `PUT /submissions/{id}` — 403 if not the owning student; 400 if
  `!Assignment.AllowResubmission` or deadline passed. On success, set `UpdatedAt`.
- Marks bounds: grading endpoint rejects `Marks < 0 || Marks > Assignment.MaxMarks` with 400.
- Draft/Publish: add `AssignmentStatus` handling — `POST /assignments` now respects an optional
  `Status` field (default Draft), add `PATCH /assignments/{id}/publish`. Student's `GET
  /assignments` must filter `Status == Published`.
- Ownership authorization: every Teacher-scoped endpoint (`PUT/DELETE/PATCH` assignment, grade,
  view submissions) must verify `Assignment.TeacherId == callingUserId`, not just role — a Teacher
  should not be able to touch another teacher's assignment even though both have role "Teacher".
- Status transitions: `PATCH /submissions/{id}/status` — Teacher only, allow moving to
  `ReturnedForRevision` etc.
- Return consistent `ProblemDetails` for all rejected cases (400/403/404) — don't leak stack
  traces; add a global exception-handling middleware if you haven't already.
**Deliverables:**
- Updated `AssignmentsController` and `SubmissionsController` with deadline, resubmission, marks-bounds, and ownership checks
- `PATCH /assignments/{id}/publish` endpoint + Draft/Published filtering live
- `PATCH /submissions/{id}/status` endpoint
- A first-pass global exception-handling middleware (will be finished properly in Phase 9)
**Definition of Done:** Manually verify each rule via Swagger (try to break each one — submit
late, resubmit when not allowed, grade over max marks, touch another teacher's assignment — all
should be rejected with the right status code).

### Phase 6 — Admin Module (backend + frontend)
**Goal:** Full CRUD for the Admin role, satisfying that section of the spec.
**Tasks (backend):**
- `AdminController` (or split into `Admin/UsersController`, `Admin/ClassesController`, etc.),
  all `[Authorize(Roles="Admin")]`:
  - Users: create (with role + optional ClassId for students), list, update, deactivate
    (`IsActive=false` — don't hard-delete users with submission/assignment history).
  - Classes: CRUD.
  - Subjects: CRUD.
  - TeacherAssignments: create/list/delete.
  - `GET /api/admin/assignments` and `GET /api/admin/submissions` — unfiltered views for oversight.
**Tasks (frontend):**
- `/admin` dashboard with tabs/pages: Users, Classes, Subjects, Teacher Assignments — simple
  tables with create/edit forms. Doesn't need to be fancy; functional CRUD tables are enough.
**Deliverables:**
- `Controllers/Admin/UsersController.cs`, `ClassesController.cs`, `SubjectsController.cs`, `TeacherAssignmentsController.cs`
- `/admin` frontend section with pages/tabs for Users, Classes, Subjects, Teacher Assignments
- Confirmed working create-a-user-and-log-in-as-them loop
**Definition of Done:** As Admin, create a brand-new Teacher and Student from the UI, assign the
teacher to a subject+class, and confirm the new teacher/student can immediately log in and use
their respective dashboards.

### Phase 7 — Unit Tests
**Goal:** Cover the business rules and authorization the spec explicitly asks for. Use
`Microsoft.EntityFrameworkCore.InMemory` for a fast in-memory `AppDbContext` per test, and `Moq`
only where you need to fake something outside the DB (e.g. the JWT claim principal).
**Required test cases (one test class per theme, in `AssignmentSystem.Tests`):**
- Submission rejected after deadline.
- Submission update rejected when `AllowResubmission == false`.
- Submission update rejected after deadline even when `AllowResubmission == true`.
- Grading rejected when `Marks > MaxMarks` and when `Marks < 0`.
- Teacher cannot grade/view submissions for an assignment they don't own.
- Draft assignments excluded from a student's assignment list.
- Student only sees assignments for their own `ClassId`.
- Login rejects wrong password / unknown email.
- Role-based 403: a Student token hitting a Teacher-only or Admin-only endpoint is rejected.
**Deliverables:**
- `AssignmentSystem.Tests/BusinessRuleTests/` — deadline, resubmission, marks-bounds tests
- `AssignmentSystem.Tests/AuthorizationTests/` — ownership and role-based rejection tests
- `AssignmentSystem.Tests/SubmissionWorkflowTests/` — end-to-end submit→grade flow tests
- A green `dotnet test` run (capture the output/summary for your own README notes)
**Definition of Done:** `dotnet test` runs green with all of the above present (aim for 15–20
tests minimum — that's a defensible "important business rules, authorization, and submission
workflows" coverage per the spec's wording).

### Phase 8 — Frontend Polish
**Goal:** Tighten the parts the spec calls out by name: "form validation," "responsive UI."
**Tasks:**
- Zod schemas for every form (login, assignment create/edit, grading, admin CRUD forms) wired
  through `@hookform/resolvers`, with inline error messages.
- Loading and error states for every API call (spinners, disabled buttons while submitting,
  toast/inline error on failure) — an evaluator will click around and a silently-failing button
  reads as broken.
- Pass on responsive breakpoints — check the main list/detail pages at mobile width (375px) and
  fix any obvious overflow.
- If time allows: move the JWT from localStorage to an httpOnly cookie set by a Next.js route
  handler, to close the XSS-exposure gap noted in Section 1. Otherwise, explicitly note it as a
  known limitation in the README (this is a fine thing to leave as a documented tradeoff for a
  time-boxed project).
**Deliverables:**
- Zod validation schemas applied to every form
- Loading/error/disabled states across all API-calling components
- Verified responsive layout at mobile width on every page
- (If done) httpOnly cookie auth route handler, replacing localStorage token storage
**Definition of Done:** Click through every page as each role at both desktop and mobile widths;
no broken layouts, no silent failures.

### Phase 9 — Logging, Error Handling, Swagger
**Goal:** Satisfy "validation, error handling, logging, Swagger/OpenAPI" explicitly.
**Tasks:**
- Serilog configured in `Program.cs` (console + rolling file sink), request logging middleware.
- Log at minimum: every failed login attempt, every authorization rejection (403), unhandled
  exceptions (with correlation/trace id).
- Global exception handling middleware returning `ProblemDetails` with a trace id, so unhandled
  errors never leak a raw stack trace to the client.
- Swagger: add XML doc comments or `[SwaggerOperation]`/summary attributes to controllers so the
  generated docs are actually readable, not just auto-named. Confirm the JWT "Authorize" flow
  still works end to end from a clean Swagger load.
**Deliverables:**
- Serilog wired in `Program.cs` with console + file sink, log files being written locally
- Finished global exception-handling middleware (`ProblemDetails` + trace id on every unhandled error)
- Swagger docs annotated with summaries on every controller action
**Definition of Done:** Trigger an unhandled exception deliberately (e.g. bad DB state) and
confirm the client gets a clean `ProblemDetails` response, not a stack trace, and that it's logged.

### Phase 10 — Documentation & Packaging (required, not optional)
**Goal:** Everything in the spec's "Submission Guidelines" checklist.
**Tasks:**
- `README.md`: project overview, feature list, tech stack, project structure, setup instructions
  (backend + frontend, from clone to running), database setup (migration + seed — evaluator should
  never need to hand-create tables), how to run tests, the Assumptions from Section 1, known
  limitations (e.g. localStorage JWT if you didn't get to Phase 8's cookie migration, text-only
  submissions, no file upload), and the three demo credential sets from Section 5.
- `.env.example` at repo root with the content from Section 5.
- Confirm no real secrets are committed — check `appsettings.Development.json` and `.env.local`
  are gitignored, and that `.env.example` only has placeholder values.
- Confirm migration files and seed data are committed so `dotnet ef database update` alone
  recreates the schema + demo data with no manual steps.
- Re-read the spec's Section 5 "Final Checklist" line by line against what you actually built.
**Deliverables:**
- Completed `README.md` at repo root
- `.env.example` at repo root (placeholders only)
- Verified `.gitignore` coverage — no secrets in git history
- Verified migrations + seed data are committed
- **The submission itself:** a repo link ready to paste into https://q-rp.com/c/4CIs
**Definition of Done:** Delete your local DB, follow your own README from a clean checkout, and
confirm you land on a working app with the three demo logins working, with zero undocumented
steps.

### Phase 11 — Optional Additions (only if everything above is done with time to spare)
Pick from, in this rough priority order (spec lists these as explicitly non-mandatory):
- Pagination + filtering on assignment/submission lists.
- Docker Compose for the whole stack (Postgres + API + frontend) — biggest "polish" signal for
  least effort if you have ~30 minutes.
- File upload for submissions (replacing/supplementing the text answer).
- Notifications (e.g. a simple "new grade" indicator on the student dashboard — no need for email).
- A deployed live URL + hosted Swagger URL.

**Deliverables:** whichever of the above you pick, e.g. `docker-compose.yml` at repo root, query
params (`page`, `pageSize`, filters) on list endpoints, a file-upload endpoint + storage handling,
a notification indicator component, or a live URL added to the README.

---

## 7. Final Submission Checklist (from spec Section 5 — verify all before submitting)

- [ ] Repository link is accessible (public, or evaluator added as collaborator).
- [ ] Frontend and backend both included in the repo.
- [ ] Database can be created using provided migrations/seed with no manual table creation.
- [ ] Demo accounts for all three roles work.
- [ ] README explains how to run the project and its tests.
- [ ] Role-based access is enforced by the backend API (not just hidden in the frontend UI).
- [ ] Important business rules are implemented and tested.
- [ ] No real secrets or credentials are committed.
- [ ] Submit repo link at https://q-rp.com/c/4CIs before the deadline.
