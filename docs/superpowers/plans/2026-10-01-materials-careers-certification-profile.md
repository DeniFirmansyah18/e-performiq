# Course Materials, Public Careers, Certification & Self-Service Profile - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add learnable course materials (modules/lessons/quizzes), a public careers portal for external candidates to submit CV + personal data, automatic certification on completion of mandatory onboarding training, and a self-service employee profile editor (limited fields + audit).

**Architecture:** Migration 0010 adds 5 tables + 2 enums + columns; pure engines grade quizzes and build certificate numbers; services orchestrate module completion (reusing the existing `completion-engine` + `lmsObserver`) to auto-issue certificates; public (session-less) routes serve the careers portal and certificate verification; authenticated routes serve lesson viewing and profile self-service; UI adds a lesson viewer, careers page, profile menu, and HR panels.

**Tech Stack:** Next.js 14, React 18, TypeScript, Drizzle ORM over PGlite, Vitest, Tailwind, `zod`, existing `ok/fail` + RFC7807 + `assertCan` + `scope.ts`.

**Spec:** `docs/superpowers/specs/2026-10-01-materials-careers-certification-profile-design.md`

## Global Constraints

- Migrations idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, ENUM via `DO $$ ... EXCEPTION WHEN duplicate_object`); numbered `0010_...`; tracked in `__migrations`; run `npm run db:migrate`.
- Responses: `ok(data, message?)` / `fail(code, message, status)` from `src/lib/api/response.ts`; thrown domain errors -> `problem(err, instance)` (RFC 7807).
- RBAC: authenticated routes call `assertCan(session, permission)`; employee-scoped access uses `resolveVisibleEmployeeIds` + `assertEmployeeVisible` from `src/lib/auth/scope.ts`.
- Public routes take NO session (no `getAuthSession`); validate with `zod`; reject if honeypot field `website` is non-empty.
- Audit: profile updates write one `audit_logs` row via `logAction(db, { actionType:'UPDATE', entityName:'employees', recordId, oldData, newData, userId })` (`AuditRecordInput` in `src/lib/repositories/auditRepository.ts`).
- Do NOT modify `gpa-engine`, `severance-engine`, `vmai-engine`, `completion-engine`, `lmsObserver`, or existing migrations.
- Tests: unit tests avoid DB; integration tests use `createTestDb()` from `tests/setup.ts`. Worktree/merged-repo test cmd: `.\node_modules\.bin\vitest.cmd run <path>`; build `npm run build`.
- All seed INSERTs `ON CONFLICT DO NOTHING`.

## Review Focus

Inputs/conditions the spec implies but no single task's happy path covers - each has a test in its owning task:

1. **Mandatory course completed twice** must not issue duplicate certificates or duplicate module completions. (Task 9, Task 10)
2. **Quiz with wrong answers** must not mark the module complete / pass (score < 70). (Task 3, Task 8)
3. **Public endpoints without session** must work, and a non-empty honeypot must be rejected. (Task 11)
4. **Profile update of a sensitive field** (salary/position/NIP) must be rejected; allowed fields persist + audit row written. (Task 12)
5. **Unknown application number / certificate code** returns 404, not 500. (Task 11)

---

## WS-1 - Schema & Seed

### Task 1: Migration 0010 + schema test

**Files:**
- Create: `src/lib/db/migrations/0010_recruitment_learning_profile.sql`
- Modify: `tests/integration/schema.test.ts` (table count 48 -> 53, enum count 16 -> 18, add 5 tables)
- Test: `tests/integration/materials-careers-schema.test.ts` (new)

**Interfaces:**
- Consumes: `runMigrations`, `createTestDb()`.
- Produces: tables `course_modules, course_completions, certificates, candidates, job_applications`; enums `content_type_enum, application_status_enum`; columns on `job_postings` (`is_public`) and `employees` (profile fields).

- [ ] **Step 1: Write the failing schema test**

Create `tests/integration/materials-careers-schema.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

const NEW_TABLES = ['course_modules', 'course_completions', 'certificates', 'candidates', 'job_applications'];

describe('migration 0010: materials/careers/profile tables', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); });
  afterAll(async () => { await client.close(); });

  it('membuat seluruh tabel baru', async () => {
    for (const t of NEW_TABLES) {
      const r = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS exists`, [t]);
      expect(r.rows[0].exists, `missing ${t}`).toBe(true);
    }
  });

  it('menambah kolom profil pada employees dan is_public pada job_postings', async () => {
    const emp = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='employees'`);
    const cols = emp.rows.map((r) => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(['date_of_birth', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'photo_url', 'bio']));
    const jp = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='job_postings'`);
    expect(jp.rows.map((r) => r.column_name)).toContain('is_public');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/materials-careers-schema.test.ts`
Expected: FAIL - relations do not exist.

- [ ] **Step 3: Create the migration (idempotent)**

Create `src/lib/db/migrations/0010_recruitment_learning_profile.sql`:
```sql
-- 0010: course materials, certificates, public recruitment, self-service profile. Idempotent.
DO $$ BEGIN CREATE TYPE content_type_enum AS ENUM ('TEXT','VIDEO','PDF','QUIZ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE application_status_enum AS ENUM ('SUBMITTED','SCREENING','INTERVIEW','OFFERED','HIRED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id INT NOT NULL REFERENCES moodle_courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  content_type content_type_enum NOT NULL DEFAULT 'TEXT',
  content_url TEXT,
  content_body TEXT,
  quiz_key JSONB
);

CREATE TABLE IF NOT EXISTS course_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES moodle_courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, module_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_no VARCHAR(80) UNIQUE NOT NULL,
  verification_code VARCHAR(40) UNIQUE NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES moodle_courses(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, course_id)
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  address TEXT,
  birth_date DATE,
  education VARCHAR(200),
  resume_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_no VARCHAR(40) UNIQUE NOT NULL,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  cover_letter TEXT,
  status application_status_enum NOT NULL DEFAULT 'SUBMITTED',
  applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bio TEXT;
```

- [ ] **Step 4: Verify the schema test passes**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/materials-careers-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `tests/integration/schema.test.ts`**

Add the 5 new tables to `EXPECTED_TABLES` alphabetically and change the count to 53 and enum count to 18.

- [ ] **Step 6: Run schema tests + commit**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/schema.test.ts tests/integration/materials-careers-schema.test.ts tests/integration/schema-migrations.test.ts`
Expected: PASS.
```bash
git add -A; git commit -m "feat(careers/lms): migration 0010 - materials, certificates, candidates, profile columns"
```

---

### Task 2: Seed materials, public posting, sample candidate & certificate

**Files:**
- Modify: `src/lib/db/seed/index.ts`
- Test: `tests/integration/materials-careers-seed.test.ts` (new)

**Interfaces:**
- Consumes: migration 0010 tables.
- Produces: seeded `course_modules` for 2-3 courses (including a mandatory onboarding course with a QUIZ), one public `job_postings` row, one `candidates` + `job_applications` row, one `certificates` row.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/materials-careers-seed.test.ts` asserting after `createTestDb()` + `runSeed`:
`course_modules` >= 6, at least one module with `content_type='QUIZ'`, `job_postings` with `is_public=TRUE` >= 1, `candidates` >= 1, `job_applications` >= 1, `certificates` >= 1, and idempotency (run twice -> unchanged counts).

- [ ] **Step 2: Run to verify failure** -> FAIL (counts 0).

- [ ] **Step 3: Add the seed block**

Append idempotent INSERTs:
- `course_modules`: for `ONB-101` (TEXT + VIDEO + QUIZ), `AKHLAK-CULTURE` (TEXT/PDF), `CLOUD-ARCH` (VIDEO/TEXT). QUIZ row includes `quiz_key` JSONB e.g. `[{"q":1,"a":1},{"q":2,"a":0}]`.
- `job_postings`: set `is_public=TRUE` on the existing posting (UPDATE) or insert one public posting referencing a seeded manpower_plan.
- `candidates` + `job_applications`: one sample candidate with `application_no`.
- `certificates`: one row for Budi on a completed course (deterministic `certificate_no`/`verification_code`).

- [ ] **Step 4: Run the seed test** -> PASS.

- [ ] **Step 5: Commit**

```bash
git add -A; git commit -m "feat(careers/lms): seed materials, public posting, sample candidate and certificate"
```

---

## WS-2 - Engines & Services

### Task 3: quiz-engine and certificate-engine (pure)

**Files:**
- Create: `src/lib/engines/quiz-engine.ts`, `src/lib/engines/certificate-engine.ts`
- Test: `tests/unit/quizEngine.test.ts`, `tests/unit/certificateEngine.test.ts` (new)

**Interfaces:**
- Produces: `gradeQuiz(answers: number[], key: { q: number; a: number }[]): { correct: number; total: number; score: number; passed: boolean }` (passed when score >= 70).
- Produces: `buildCertificateNo(employeeCode: string, courseCode: string, date: Date): string`; `buildVerificationCode(seed: string): string` (uppercase alnum, deterministic).

- [ ] **Step 1: Write the failing tests**

`tests/unit/quizEngine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { gradeQuiz } from '@/lib/engines/quiz-engine';

describe('quiz-engine', () => {
  const key = [{ q: 1, a: 1 }, { q: 2, a: 0 }];
  it('menilai jawaban benar & lulus', () => {
    expect(gradeQuiz([1, 0], key)).toEqual({ correct: 2, total: 2, score: 100, passed: true });
  });
  it('gagal bila skor < 70', () => {
    const r = gradeQuiz([0, 0], key);
    expect(r.score).toBe(50);
    expect(r.passed).toBe(false);
  });
  it('null-safe untuk kuis kosong', () => {
    expect(gradeQuiz([], [])).toEqual({ correct: 0, total: 0, score: 0, passed: false });
  });
});
```

`tests/unit/certificateEngine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildCertificateNo, buildVerificationCode } from '@/lib/engines/certificate-engine';

describe('certificate-engine', () => {
  it('membangun nomor sertifikat deterministik', () => {
    const d = new Date('2026-10-01T00:00:00Z');
    expect(buildCertificateNo('EMP-2022-0042', 'CLOUD-ARCH', d)).toBe('CERT-EMP20220042-CLOUDARCH-20261001');
  });
  it('membangun kode verifikasi unik & berformat', () => {
    const c = buildVerificationCode('EMP-2022-0042-CLOUD-ARCH-2026-10-01');
    expect(c).toMatch(/^[A-Z0-9]{8,}$/);
    expect(buildVerificationCode('same')).toBe(buildVerificationCode('same'));
  });
});
```

- [ ] **Step 2: Run to verify failure** -> `.\node_modules\.bin\vitest.cmd run tests/unit/quizEngine.test.ts tests/unit/certificateEngine.test.ts` -> FAIL.

- [ ] **Step 3: Implement**

`src/lib/engines/quiz-engine.ts`:
```ts
export function gradeQuiz(answers: number[], key: { q: number; a: number }[]) {
  const total = key?.length ?? 0;
  if (!total) return { correct: 0, total: 0, score: 0, passed: false };
  let correct = 0;
  for (const item of key) if (answers?.[item.q - 1] === item.a) correct++;
  const score = Number(((correct / total) * 100).toFixed(2));
  return { correct, total, score, passed: score >= 70 };
}
```

`src/lib/engines/certificate-engine.ts`:
```ts
export function buildCertificateNo(employeeCode: string, courseCode: string, date: Date): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  const emp = employeeCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const crs = courseCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `CERT-${emp}-${crs}-${d}`;
}

export function buildVerificationCode(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase().padStart(8, '0').slice(0, 12);
}
```

- [ ] **Step 4: Verify PASS, then commit**

```bash
git add -A; git commit -m "feat(lms): quiz + certificate engines"
```

---

### Task 4: courseContentService (modules, lessons, complete, quiz)

**Files:**
- Create: `src/lib/services/courseContentService.ts`
- Test: `tests/integration/courseContentService.test.ts` (new)

**Interfaces:**
- Consumes: migration 0010 tables; `completion-engine.computeCourseProgress`; `lmsObserver.onCourseCompleted`; `certificateService` (Task 5) - import may be added when Task 5 lands.
- Produces:
  - `listModules(db, courseId, employeeId?)` -> `Array<{ id, title, orderIndex, contentType, completed }>`.
  - `getLesson(db, moduleId)` -> module row.
  - `completeModule(db, employeeId, moduleId)` -> `{ courseId, progress, completed, certificate? }` (calls observer + certificate on 100%).
  - `submitQuiz(db, employeeId, moduleId, answers)` -> `{ passed, score, completed }` (completes module when passed).

- [ ] **Step 1: Write the failing test**

`tests/integration/courseContentService.test.ts`: after `createTestDb()` + `runSeed`,
- `listModules(db, onb101CourseId)` returns >= 3 modules with `contentType` present and `completed:false`.
- `submitQuiz` with all-correct answers on the QUIZ module -> `passed:true`; with wrong answers -> `passed:false`.
- `completeModule` marks it complete (a `course_completions` row exists) and, when it is the last module of a mandatory course, returns a `certificate` (non-null).

- [ ] **Step 2: Run to verify failure** -> FAIL (module not found).

- [ ] **Step 3: Implement** using `getDb`-style `db: Db` (raw SQL via drizzle `sql`), `computeCourseProgress`, `onCourseCompleted`, and `issueCertificate` (Task 5). `completeModule` first inserts `course_completions ON CONFLICT DO NOTHING`, then computes progress from `course_modules` vs `course_completions`, updates the enrollment (`recordProgress`-like UPDATE), and if 100% calls `onCourseCompleted` then `issueCertificate` for mandatory courses.

- [ ] **Step 4: Verify PASS, then commit**

```bash
git add -A; git commit -m "feat(lms): course content service (modules, lessons, complete, quiz)"
```

---

### Task 5: certificateService

**Files:**
- Create: `src/lib/services/certificateService.ts`
- Test: `tests/integration/certificateService.test.ts` (new)

**Interfaces:**
- Consumes: `certificate-engine`, migration 0010 `certificates`.
- Produces:
  - `issueCertificate(db, employeeId, courseId)` -> certificate row (idempotent; returns existing if present).
  - `getCertificatesForEmployee(db, employeeId)` -> array.
  - `verifyCertificate(db, code)` -> `{ valid: boolean; certificate?: {...} }`.

- [ ] **Step 1: Write the failing test**

`tests/integration/certificateService.test.ts`:
- `issueCertificate(db, BUDI, courseId)` returns a row with `certificateNo` + `verificationCode`; calling again returns the SAME certificate (idempotent; count stays 1).
- `getCertificatesForEmployee(db, BUDI)` includes it.
- `verifyCertificate(db, <that code>)` -> `valid:true`; unknown code -> `valid:false`.

- [ ] **Step 2: Run to verify failure** -> FAIL.

- [ ] **Step 3: Implement** with `ON CONFLICT (employee_id, course_id) DO NOTHING` then SELECT; derive codes via `certificate-engine` (fetch `employee_code` + `course_code`).

- [ ] **Step 4: Verify PASS, then commit**

```bash
git add -A; git commit -m "feat(lms): certificate service (issue, list, verify)"
```

---

### Task 6: candidateService (public intake + HR)

**Files:**
- Create: `src/lib/services/candidateService.ts`
- Test: `tests/integration/candidateService.test.ts` (new)

**Interfaces:**
- Consumes: `candidates`, `job_applications`, `job_postings`.
- Produces:
  - `listPublicPostings(db)` -> postings where `is_public=true AND status='OPEN'`.
  - `submitApplication(db, payload)` -> `{ applicationNo, status }` (creates candidate + application; unique `application_no`).
  - `getApplicationStatus(db, applicationNo)` -> `{ applicationNo, status, postingTitle } | null`.
  - `listCandidates(db)` -> applications joined with candidate + posting.
  - `updateApplicationStatus(db, applicationId, status)` -> updated row.

- [ ] **Step 1: Write the failing test**

`tests/integration/candidateService.test.ts`:
- `listPublicPostings` returns >= 1 after seed.
- `submitApplication` creates rows and returns a non-empty `applicationNo`; `getApplicationStatus` finds it; unknown number -> `null`.

- [ ] **Step 2: Run to verify failure** -> FAIL.

- [ ] **Step 3: Implement** (raw SQL; generate `application_no` as `APP-<yyyyMMdd>-<short hash>` deterministic per email+posting).

- [ ] **Step 4: Verify PASS, then commit**

```bash
git add -A; git commit -m "feat(careers): candidate service (public intake + HR listing)"
```

---

### Task 7: employeeProfileService (self-service + audit)

**Files:**
- Create: `src/lib/services/employeeProfileService.ts`
- Test: `tests/integration/employeeProfileService.test.ts` (new)

**Interfaces:**
- Consumes: `employees` columns; `auditService.logAction`.
- Produces:
  - `getMyProfile(db, employeeId)` -> profile object (sensitive fields included read-only).
  - `updateMyProfile(db, employeeId, fields, actorUserId)` -> updated profile; only the allowlist
    `phone_number, address, date_of_birth, emergency_contact_name, emergency_contact_phone, photo_url, bio` is applied;
    writes one `audit_logs` row.

- [ ] **Step 1: Write the failing test**

`tests/integration/employeeProfileService.test.ts`:
- `getMyProfile(db, BUDI)` returns `fullName` and `employeeCode`.
- `updateMyProfile(db, BUDI, { phone_number: '+62 812-0000-0000', base_salary: 1 }, HR_USER)` -> `phone_number` updated, `base_salary` UNCHANGED (sensitive ignored).
- One `audit_logs` row with `entity_name='employees'` and `record_id=BUDI` exists after the update.

- [ ] **Step 2: Run to verify failure** -> FAIL.

- [ ] **Step 3: Implement** (allowlist filter; build SET clause; call `logAction`).

- [ ] **Step 4: Verify PASS, then commit**

```bash
git add -A; git commit -m "feat(profile): employee self-service profile service with audit"
```


---

## WS-3 - API Routes & RBAC

### Task 8: RBAC permissions + authenticated learning/profile routes

**Files:**
- Modify: `src/lib/auth/rbac.ts` (add `recruitment:read`, `recruitment:manage`, `profile:read`, `profile:write`)
- Create: `src/app/api/v1/learning/courses/[id]/modules/route.ts`, `src/app/api/v1/learning/modules/[id]/route.ts`, `src/app/api/v1/learning/modules/[id]/complete/route.ts`, `src/app/api/v1/learning/modules/[id]/quiz/route.ts`, `src/app/api/v1/learning/certificates/route.ts`, `src/app/api/v1/profile/me/route.ts`
- Test: `tests/api/materials-profile-routes.test.ts` (new)

**Interfaces:**
- Consumes: `courseContentService`, `certificateService`, `employeeProfileService`, `getAuthSession`, `assertCan`.
- Produces: the authenticated endpoints from spec Â§3 WS-3.

- [ ] **Step 1: Write the failing route tests**

`tests/api/materials-profile-routes.test.ts`:
- `GET /learning/courses/:id/modules` 401 without session; 200 with cookie, `data.modules` array.
- `POST /learning/modules/:id/complete` with session -> 200, `data.completed` true.
- `GET /learning/certificates` -> `data.certificates` array.
- `PATCH /profile/me` with `{ phone_number }` -> 200 and value persisted; `GET /profile/me` reflects it.

- [ ] **Step 2: Run to verify failure** -> FAIL (routes 404 / RBAC missing).

- [ ] **Step 3: Add permissions**

`rbac.ts`: `'recruitment:read'`: HR_MANAGER, SUPER_ADMIN, BOD, AUDITOR; `'recruitment:manage'`: HR_MANAGER, SUPER_ADMIN; `'profile:read'`/`'profile:write'`: all roles.

- [ ] **Step 4: Implement the routes**

Each: `getAuthSession` -> `assertCan` -> service -> `ok()`; `problem()` on error; `zod` for bodies.
`PATCH /profile/me` passes `session.userId` as actor for audit.

- [ ] **Step 5: Verify PASS + commit**

```bash
git add -A; git commit -m "feat(lms/profile): authenticated materials + certificates + profile routes"
```

---

### Task 9: Public routes (careers + certificate verification) + HR recruitment routes

**Files:**
- Create: `src/app/api/v1/careers/postings/route.ts`, `src/app/api/v1/careers/apply/route.ts`, `src/app/api/v1/careers/status/[applicationNo]/route.ts`, `src/app/api/v1/certificates/verify/[code]/route.ts`, `src/app/api/v1/recruitment/candidates/route.ts`, `src/app/api/v1/recruitment/candidates/[id]/status/route.ts`
- Test: `tests/api/careers-routes.test.ts` (new)

**Interfaces:**
- Consumes: `candidateService`, `certificateService`, `assertCan`.
- Produces: public endpoints (no session) + HR endpoints.

- [ ] **Step 1: Write the failing tests**

`tests/api/careers-routes.test.ts`:
- `GET /careers/postings` (NO cookie) -> 200 with `data.postings` array.
- `POST /careers/apply` (NO cookie) valid body -> 200 with `applicationNo`; body with `website:'x'` (honeypot) -> 400.
- `GET /careers/status/UNKNOWN` -> 404.
- `GET /certificates/verify/UNKNOWN` -> 404.
- `GET /recruitment/candidates` without cookie -> 401; with HR cookie -> 200.

- [ ] **Step 2: Run to verify failure** -> FAIL.

- [ ] **Step 3: Implement**

Public routes: NO `getAuthSession`; `zod` validate; reject when `website` field non-empty (honeypot). HR routes: `getAuthSession` + `assertCan('recruitment:read'/'recruitment:manage')`.

- [ ] **Step 4: Verify PASS + commit**

```bash
git add -A; git commit -m "feat(careers): public careers + certificate verification + HR recruitment routes"
```

---

## WS-4 - UI (frontend-design skill)

### Task 10: Lesson viewer + certificates tab (employee Learning module)

**Files:**
- Create: `src/components/employee/LessonViewerModal.tsx`, `src/components/employee/CertificatesTab.tsx`
- Modify: `src/components/employee/LearningModule.tsx` (open lesson viewer on course click; add Certificates tab)
- Test: build + browser smoke

- [ ] **Step 1: Build the lesson viewer**

On course click, fetch `/learning/courses/:id/modules`; render module list with per-module completed state; open lesson (`content_type` TEXT/VIDEO/PDF/QUIZ); "Tandai selesai" calls `/learning/modules/:id/complete`; QUIZ renders questions and posts to `/learning/modules/:id/quiz`; on completion refresh progress and show certificate when issued.

- [ ] **Step 2: Certificates tab**

Fetch `/learning/certificates`; list certificate numbers + issued date + a "Verifikasi" link to `/certificates/verify/:code`.

- [ ] **Step 3: Build + smoke**

Run: `npm run build` -> success. Smoke: open a course -> modules load -> complete a module -> progress updates.

- [ ] **Step 4: Commit**

```bash
git add -A; git commit -m "feat(lms-ui): lesson viewer + quizzes + certificates tab"
```

---

### Task 11: Public careers page + profile menu

**Files:**
- Create: `src/app/careers/page.tsx`, `src/components/employee/MyProfileModal.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx` (add "Profil Saya" button opening `MyProfileModal`)
- Test: build + browser smoke

- [ ] **Step 1: Careers page (public)**

`/careers`: fetch `/careers/postings`; render open roles; application form (full_name, email, phone, address, birth_date, education, resume_url, cover_letter, hidden honeypot `website`); on success show `applicationNo` + status lookup form (`/careers/status/:no`).

- [ ] **Step 2: Profile menu**

`MyProfileModal`: fetch `/profile/me`; editable allowlisted fields; sensitive fields shown read-only; PATCH `/profile/me`; success toast.

- [ ] **Step 3: Build + smoke**

Run: `npm run build`. Smoke: open `/careers` (no login) -> postings load; submit a form -> applicationNo appears; open Profil Saya -> edit phone -> saved.

- [ ] **Step 4: Commit**

```bash
git add -A; git commit -m "feat(careers-ui): public careers page + employee self-service profile"
```

---

### Task 12: HR panels (recruitment + onboarding training)

**Files:**
- Create: `src/components/governance/RecruitmentPanel.tsx`, `src/components/governance/OnboardingTrainingPanel.tsx`
- Modify: `src/app/dashboard/hr-command/page.tsx`
- Test: build + browser smoke

- [ ] **Step 1: Recruitment panel**

Fetch `/recruitment/candidates`; table of applicants + status dropdown calling `PATCH /recruitment/candidates/:id/status`.

- [ ] **Step 2: Onboarding training panel**

List mandatory courses + per-employee completion/certificate status (derive from `/learning/training-summary` plus a new aggregate field if needed; keep read-only if data exists).

- [ ] **Step 3: Build + smoke + commit**

```bash
git add -A; git commit -m "feat(hr-ui): recruitment candidates + onboarding training panels"
```

---

## WS-5 - Verification, ADRs, README

### Task 13: Full verification, ADRs 010/011, README

**Files:**
- Create: `docs/decisions/010-public-careers-and-candidate-intake.md`, `docs/decisions/011-course-materials-and-certification.md`
- Modify: `README.md`

- [ ] **Step 1: Full verification**

Run: `.\node_modules\.bin\vitest.cmd run` -> all pass; `npm run build` -> success; `npm run db:reset` -> success.

- [ ] **Step 2: ADR 010** - public careers portal (session-less), zod + honeypot, non-goals (no full ATS, no binary upload).

- [ ] **Step 3: ADR 011** - course materials (modules/lessons/quizzes) + automatic certification tied to `lmsObserver`/badges.

- [ ] **Step 4: README** - document `/careers`, lesson materials, certificates, and the Profil Saya menu.

- [ ] **Step 5: Commit**

```bash
git add -A; git commit -m "docs: ADRs 010/011 and README for careers/materials/profile"
```

---

## Spec Coverage Check

| Spec WS | Plan task(s) |
|---|---|
| WS-1 Schema (0010) | Task 1 |
| WS-1 Seed | Task 2 |
| WS-2 quiz-engine + certificate-engine | Task 3 |
| WS-2 courseContentService | Task 4 |
| WS-2 certificateService | Task 5 |
| WS-2 candidateService | Task 6 |
| WS-2 employeeProfileService | Task 7 |
| WS-3 authenticated routes + RBAC | Task 8 |
| WS-3 public + HR routes | Task 9 |
| WS-4 lesson viewer + certificates | Task 10 |
| WS-4 careers page + profile menu | Task 11 |
| WS-4 HR panels | Task 12 |
| WS-5 verification + ADRs | Task 13 |

## Execution Handoff

- **Subagent-driven** if a writable model is available (per-task review).
- **Native (inline)** otherwise - the controller implements each task TDD, commit per task, one whole-branch review. (Used previously because the paid gateway was unavailable.)

Strict order: Task 1 -> 2 -> 3 -> 5 -> 4 (4 depends on 5's `issueCertificate`) -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13. Do not start a task whose `Consumes` are not committed. Note the Task 4/5 ordering: implement `certificateService` (Task 5) before `courseContentService` (Task 4) so its import resolves.

