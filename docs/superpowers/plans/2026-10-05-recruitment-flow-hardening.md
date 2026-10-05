# Recruitment Flow Hardening — Implementation Plan

**Goal:** Make the public-candidate recruitment pipeline (`/careers` → HR) work end-to-end: visible input text, employee-menu parity, working email+WhatsApp notifications, tests gated on HR screening, an HR meeting-link feature the candidate can see, and full HR status control (SCREENING → INTERVIEW → OFFERED/HIRED/REJECTED) with notifications at each step.

**Architecture:** Next.js 14 App Router (route handlers under `src/app/api/v1/**`) + Drizzle ORM over a dual driver (PGlite dev / postgres-js prod). Business logic lives in `src/lib/services/*` (plain `db`-taking functions); route handlers are thin (parse → assert → service → `ok/fail/problem`). Candidate pipeline is `job_applications` + `application_timeline` + `assessment_*` + `interview_schedules` + `candidate_notifications` + `email_outbox`. Notifications are best-effort and must never block a write.

**Tech Stack:** TypeScript, Next.js 14, React 18, Tailwind (`darkMode:'class'`), Zod, Drizzle, Vitest 2.1.9 (route tests share dev `.pglite`; integration tests use `createTestDb()`).

**Spec:** `docs/superpowers/specs/2026-10-05-recruitment-flow-hardening-design.md`

**Review Focus:** (1) notification code must never throw into the request path; (2) status gating must be enforced in the **service**, not just the route/UI; (3) no schema changes unless strictly required (store schedule extras in `notes`); (4) every new route needs a Vitest test; (5) no push — commit per task only.

---

## Global Constraints

- Node ≥ 18. Run commands with the Node path prefixed if `npm` is not found:
  `$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1`
- Tests: `$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run --reporter=basic`
- Do **not** edit files outside the listed paths for a task.
- Work on branch `master`. **Commit after each task. Do NOT push.**
- Keep comments in existing Indonesian style; do not add generic boilerplate comments.
- Never break the dual driver: services take `db: Db` and are driver-agnostic (raw `sql` via `db.execute`).
- All new HR routes use `getAuthSession` + `assertCan(session, 'recruitment:manage')`; all new candidate routes use `getCandidateSession` (or `...OrNull`).

---

## Task 1 — F1: Visible input text on auth/registration forms

**Files:**
- Modify: `src/app/careers/login/page.tsx`
- Modify: `src/app/careers/register/page.tsx`
- Modify: `src/app/employee/register/page.tsx`
- Verify (edit only if missing): `src/app/login/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (pure styling). Root rule — `input, textarea, select { color: #0f172a; }` — guarantees visible text even if a class is forgotten.

**Root cause:** `<html className="dark">` + `<body className="... text-slate-100 ...">` in `src/app/layout.tsx` makes inputs inherit near-white text; on the light cards this is white-on-white.

- [ ] **Step 1: Add input text base rule to `globals.css`**

Append inside the `@layer base { ... }` block (after the existing `body`/reset rules):

```css
  input, textarea, select {
    color: #0f172a;
  }
  input::placeholder, textarea::placeholder {
    color: #94a3b8;
  }
```

- [ ] **Step 2: Fix `src/app/careers/login/page.tsx` (email + password inputs)**

Add `text-[#0f172a] placeholder-[#94a3b8] bg-white` to each input `className`. Email input `className` becomes:

```
className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
```

Apply the identical className change to the password input.

- [ ] **Step 3: Fix `src/app/careers/register/page.tsx` (4 inputs)**

Apply the same className addition (`bg-white text-[#0f172a] placeholder-[#94a3b8]`) to the Nama Lengkap, Email, No. Telepon, and Kata Sandi inputs.

- [ ] **Step 4: Fix `src/app/employee/register/page.tsx` (5 inputs)**

Apply the same className addition to all 5 inputs.

- [ ] **Step 5: Verify `src/app/login/page.tsx`**

Confirm both inputs already contain `text-[#0f172a]`. If any is missing it, add the same className additions. If all present, make no change (note this in the commit body).

- [ ] **Step 6: Verify in the browser**

Run `npm run dev`, open `/careers/login`, `/careers/register`, `/login`. Type in each field and confirm the text is dark/readable on the light card in both light and dark OS themes.

- [ ] **Step 7: Commit**

```
git add src/app/globals.css src/app/careers/login/page.tsx src/app/careers/register/page.tsx src/app/employee/register/page.tsx
git commit -m "fix(careers): ensure visible input text on auth and registration forms"
```

---

## Task 2 — F2: Employee portal menu parity with HR

**Files:**
- Modify: `src/app/dashboard/employee-portal/page.tsx`

**Interfaces:**
- Consumes: `FeatureGrid`, `ActionCard`, `ExpandablePanel` (existing components).
- Produces: nothing functional (visual only).

**Goal:** The employee landing page should read like the HR command page: 4-card `FeatureGrid`, ActionCard grid `lg:grid-cols-4` (was `lg:grid-cols-5`), and matching header/hero typography.

- [ ] **Step 1: Read the HR reference for exact classes**

Open `src/app/dashboard/hr-command/page.tsx`. Note: outer wrapper `space-y-6 max-w-[1400px] mx-auto pb-12`; hero title `text-2xl font-extrabold text-[#0f172a] tracking-tight`; subtitle `text-[11px] text-[#64748b]`; `ActionCard` grid `lg:grid-cols-4`.

- [ ] **Step 2: Apply the wrapper + header parity in `employee-portal/page.tsx`**

Match the outer wrapper/hero classes from HR. Keep the employee's own copy/labels; only align structure and typography.

- [ ] **Step 3: Change the ActionCard grid to 4 columns**

Find the ActionCard grid container (currently `lg:grid-cols-5`) and change it to `lg:grid-cols-4`. Do not remove any ActionCard — the last row simply wraps.

- [ ] **Step 4: Match the FeatureGrid to 4 cards (if reasonable)**

If the employee page currently shows 3 feature cards, either keep 3 or add a 4th that is genuinely employee-relevant (e.g. "Riwayat Pelatihan"). Do **not** invent features that link to non-existent routes. If unsure, keep the existing cards and only fix the grid so it does not stretch awkwardly.

- [ ] **Step 5: Verify in the browser**

Log in as an `EMPLOYEE` account, open `/dashboard/employee-portal`, and compare side-by-side with `/dashboard/hr-command`. Confirm spacing, header size, and grid rhythm match.

- [ ] **Step 6: Commit**

```
git add src/app/dashboard/employee-portal/page.tsx
git commit -m "fix(employee): align portal landing layout with HR command page"
```

---

## Task 3 — F3: Notifications actually run (email + WhatsApp) and are observable

**Files:**
- Modify: `src/app/api/v1/careers/apply/route.ts`
- Modify: `.env.local` (documentation/placeholder only)
- Modify: `README.md`
- Create: `src/app/api/v1/careers/notifications/health/route.ts`
- Create: `tests/api/careers-notifications.test.ts`

**Interfaces:**
- Consumes:
  - `notifyApplicationSubmitted(db, { applicationId, applicationNo, email, phone, fullName, postingTitle })` → `{ email: string; whatsapp: string }` (from `@/lib/services/notificationService`) — **verify exact arg shape in the file before coding; extend the return contract if needed to include `{email, whatsapp}` status strings.**
  - `activeWaProvider()`, `normalizePhone()` from `@/lib/services/whatsappService`.
- Produces:
  - `POST /api/v1/careers/apply` response gains `notifications: { email: string; whatsapp: string }`.
  - `GET /api/v1/careers/notifications/health` → `{ data: { emailProvider: string; whatsappProvider: string; recent: OutboxRow[] } }` where `OutboxRow = { id, channel, status, error, createdAt }`.

**Cause of "notifications don't run" (all must be addressed):**
1. Errors swallowed in the apply route try/catch with no logging.
2. `EMAIL_FROM=onboarding@resend.dev` only delivers to the Resend account owner.
3. WhatsApp needs a valid phone (`/^62\d{8,13}$/`) and an active provider.
4. Provider resolves to `'none'` when env is not loaded → everything stays `QUEUED`.

- [ ] **Step 1: Inspect the current notification signatures**

Read `src/lib/services/notificationService.ts` (`notifyApplicationSubmitted`, `notifyStageChange`, `createNotification`, `sendEmail`) and `src/lib/services/whatsappService.ts` (`sendWhatsApp`). Record the exact return shapes so the health route and the apply route use real fields.

- [ ] **Step 2: Write the failing test `tests/api/careers-notifications.test.ts`**

Route test (shares dev `.pglite`, follow the pattern in `tests/api/careers-apply-ats.test.ts` — import `runSeed`, `getDb`/`db`, build a `NextRequest`, call the route handler). Cover:
1. Submitting an application returns `notifications` with `email` and `whatsapp` string keys.
2. After submit, `SELECT status FROM email_outbox ORDER BY created_at DESC LIMIT 1` is one of `SENT|FAILED|QUEUED` (not throwing), and `candidate_notifications` has at least one row for the application.
3. `GET /api/v1/careers/notifications/health` returns HTTP 200 with `data.emailProvider` and `data.whatsappProvider` strings.

- [ ] **Step 3: Run the test — confirm it fails**

`$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run tests/api/careers-notifications.test.ts --reporter=basic`

Expected: FAIL (missing `notifications` field / missing route).

- [ ] **Step 4: Make the apply route return + log notification status**

In `src/app/api/v1/careers/apply/route.ts`, replace the silent swallowing block with a block that captures the result and logs failures:

```ts
let notifications = { email: 'SKIPPED', whatsapp: 'SKIPPED' };
try {
  const r = await notifyApplicationSubmitted(db, { /* existing args */ });
  notifications = { email: r.email ?? 'UNKNOWN', whatsapp: r.whatsapp ?? 'UNKNOWN' };
  if (notifications.email === 'FAILED') console.warn('[apply] email gagal untuk', result.applicationNo);
  if (notifications.whatsapp === 'FAILED') console.warn('[apply] WA gagal untuk', result.applicationNo);
} catch (err) {
  console.warn('[apply] notifikasi error:', (err as Error)?.message);
  notifications = { email: 'ERROR', whatsapp: 'ERROR' };
}
// ...
return ok({ ...result, ats, notifications });
```

If `notifyApplicationSubmitted` does not currently return `{email, whatsapp}`, extend it to do so (return the `sendEmail`/`sendWhatsApp` status strings), keeping the change minimal and non-throwing.

- [ ] **Step 5: Create the health route `src/app/api/v1/careers/notifications/health/route.ts`**

```ts
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { activeWaProvider } from '@/lib/services/whatsappService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const emailProvider = (process.env.EMAIL_PROVIDER ?? 'none').toLowerCase();
    const whatsappProvider = activeWaProvider();
    const res = (await db.execute(sql`
      SELECT id, channel, status, error, created_at AS "createdAt"
        FROM email_outbox ORDER BY created_at DESC LIMIT 5
    `)) as unknown as { rows: any[] };
    return ok({ emailProvider, whatsappProvider, recent: res.rows });
  } catch (err) {
    return problem(err, '/api/v1/careers/notifications/health');
  }
}
```

Decide during implementation whether this is HR-gated (`recruitment:read`) or candidate-gated; default to HR-gated as shown.

- [ ] **Step 6: Set the email placeholder + document it**

In `.env.local`, set `EMAIL_FROM=E-PerformIQ <no-reply@your-domain.example>` (clearly a placeholder the user replaces with the verified-domain address). Add a short README section under "Follow-up keamanan": how to verify email (Resend verified domain in `EMAIL_FROM`), how to verify WA (`FONNTE_TOKEN`, `WA_PROVIDER=fonnte`, phone must be `62…`), and how to read the health endpoint.

- [ ] **Step 7: Run the test — confirm it passes**

Same command as Step 3. Expected: PASS.

- [ ] **Step 8: Commit**

```
git add src/app/api/v1/careers/apply/route.ts src/app/api/v1/careers/notifications/health/route.ts tests/api/careers-notifications.test.ts src/lib/services/notificationService.ts README.md
git commit -m "feat(careers): surface and log application notification status (email+WA) + health endpoint"
```

---

## Task 4 — F4: Gate psychometric & technical tests on HR screening

**Files:**
- Modify: `src/lib/services/assessmentService.ts` (`startAttempt`)
- Modify: `src/app/api/v1/careers/assessments/start/route.ts`
- Modify: `src/app/careers/portal/assessments/page.tsx`
- Create: `tests/api/careers-assessment-gating.test.ts`

**Interfaces:**
- Consumes: `resolveCandidateContext(db, session)` → `CandidateContext` (add `status`), `ForbiddenError` from `@/lib/errors`.
- Produces: `startAttempt` throws `ForbiddenError('Tes belum dibuka. Menunggu seleksi HR.')` when the application status is `SUBMITTED` or `REJECTED`. Route maps it to HTTP 403 via `problem()`.
- `CandidateContext` gains `status: string` (selected from `job_applications.status`).

**Allowed statuses to start a test:** `SCREENING`, `INTERVIEW`, `OFFERED`, `HIRED`. Blocked: `SUBMITTED`, `REJECTED`.

- [ ] **Step 1: Add `status` to `resolveCandidateContext`**

In `src/lib/services/candidateContext.ts`, add `ja.status::text AS "status"` to the SELECT and `status: string` to `CandidateContext`.

- [ ] **Step 2: Write the failing test `tests/api/careers-assessment-gating.test.ts`**

Follow the candidate-auth route test pattern (candidate session cookie). Cover:
1. With application status `SUBMITTED`, `POST /api/v1/careers/assessments/start` → HTTP 403 and message contains "belum dibuka".
2. After updating the application to `SCREENING`, the same request → HTTP 200 and returns an `attemptId`.
3. With status `REJECTED` → HTTP 403.

- [ ] **Step 3: Run the test — confirm it fails**

```
$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run tests/api/careers-assessment-gating.test.ts --reporter=basic
```

Expected: FAIL (SUBMITTED currently returns 200).

- [ ] **Step 4: Enforce the gate in `startAttempt`**

At the top of `startAttempt` in `src/lib/services/assessmentService.ts` (before the template lookup):

```ts
const appRow = (await db.execute(sql`
  SELECT status::text AS status FROM job_applications WHERE id = ${input.applicationId}::uuid
`)) as unknown as { rows: Array<{ status: string }> };
const status = appRow.rows?.[0]?.status ?? null;
const OPEN = ['SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED'];
if (!status || !OPEN.includes(status)) {
  const { ForbiddenError } = await import('@/lib/errors');
  throw new ForbiddenError('Tes belum dibuka. Menunggu seleksi HR.');
}
```

Confirm `ForbiddenError` exists and maps to 403 in `src/lib/api/response.ts` `problem()` (it does per project conventions); if the class name/path differs, use the actual one.

- [ ] **Step 5: Map the error to 403 in the route**

In `src/app/api/v1/careers/assessments/start/route.ts`, the existing `catch` calls `problem(err, ...)` which already returns 403 for `ForbiddenError` — verify and, if the route special-cases errors before `problem()`, add a `ForbiddenError` pass-through so it is not swallowed into 422.

- [ ] **Step 6: Lock the UI in `src/app/careers/portal/assessments/page.tsx`**

Fetch the application status (add to the existing load call, e.g. via the status endpoint or the applications list the page already uses). When status is `SUBMITTED`/`REJECTED`, render a banner — "Tes belum dibuka. Menunggu seleksi HR." — and disable the "Mulai Tes" buttons. When `SCREENING`+, enable them. Handle the 403 from the API gracefully (show the banner instead of a raw error).

- [ ] **Step 7: Run the test — confirm it passes**

Same command as Step 3. Expected: PASS.

- [ ] **Step 8: Commit**

```
git add src/lib/services/assessmentService.ts src/lib/services/candidateContext.ts src/app/api/v1/careers/assessments/start/route.ts src/app/careers/portal/assessments/page.tsx tests/api/careers-assessment-gating.test.ts
git commit -m "feat(careers): gate psychometric/technical tests until HR screening"
```

---

## Task 5 — F5: HR meeting-link scheduling + mark done; candidate sees the link

**Files:**
- Create: `src/app/api/v1/recruitment/interviews/[id]/route.ts` (PATCH)
- Create: `src/components/governance/InterviewSchedulerPanel.tsx`
- Modify: `src/app/dashboard/hr-command/page.tsx` (mount the panel)
- Modify: `src/app/careers/portal/page.tsx` (candidate "Jadwal Wawancara" card)
- Create: `tests/api/recruitment-interview-schedule.test.ts`

**Interfaces:**
- Consumes: `interview_schedules` table (id, application_id, interviewer_user_id, scheduled_at, meeting_url, duration_minutes, score, notes, status); `syncApplicationTimeline(db, applicationId)`; `notifyStageChange`; existing `POST /api/v1/recruitment/interviews`; `PATCH /api/v1/recruitment/candidates/[id]/status`.
- Produces:
  - `PATCH /api/v1/recruitment/interviews/[id]` body `{ status: 'DONE'|'CANCELED', score?: number, notes?: string }` → `ok(updated)`; RBAC `recruitment:manage`; on `DONE` calls `syncApplicationTimeline` + notify.
  - `GET /api/v1/careers/interviews` (candidate) → `{ data: { scheduledAt, meetingUrl, durationMinutes, status, interviewerName } | null }` for the candidate's latest application. **Add this small candidate endpoint** so the portal card has data (alternatively reuse `/careers/status` timeline data if it already exposes `meetingUrl` — prefer that if it does; do not duplicate).

- [ ] **Step 1: Inspect `interview_schedules` + timeline enrichment**

Confirm column names from `src/lib/db/migrations/*.sql` and how `getTimelineByApplicationNo` enriches INTERVIEW (`meetingUrl`, `scheduledAt`, `interviewerName`). Decide: if `/careers/status` already returns those fields, the portal card can consume the same endpoint (no new endpoint). Record the decision in the task commit.

- [ ] **Step 2: Write the failing test `tests/api/recruitment-interview-schedule.test.ts`**

HR-authenticated route test (`getAuthSession` mocked/real session per existing HR route tests). Cover:
1. `POST /api/v1/recruitment/interviews` with `{ applicationId, scheduledAt, meetingUrl }` → 200, row `status='SCHEDULED'`, and `job_applications.status` becomes `INTERVIEW` (the panel sets this via the status PATCH; if the API sets it, assert it here).
2. `PATCH /api/v1/recruitment/interviews/[id]` `{ status: 'DONE' }` → 200 and `interview_schedules.status='DONE'`.
3. After `DONE`, the application's INTERVIEW timeline stage is `PASSED` (or `IN_PROGRESS`, per `syncApplicationTimeline` behavior — assert the actual mapping).

- [ ] **Step 3: Run the test — confirm it fails**

```
$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run tests/api/recruitment-interview-schedule.test.ts --reporter=basic
```

Expected: FAIL (PATCH route missing).

- [ ] **Step 4: Create `src/app/api/v1/recruitment/interviews/[id]/route.ts`**

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  status: z.enum(['DONE', 'CANCELED']),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Data tidak valid.', 400);

    const res = (await db.execute(sql`
      UPDATE interview_schedules
         SET status = ${parsed.data.status},
             score = COALESCE(${parsed.data.score ?? null}, score),
             notes = COALESCE(${parsed.data.notes ?? null}, notes)
       WHERE id = ${ctx.params.id}::uuid
      RETURNING id, application_id AS "applicationId", status, meeting_url AS "meetingUrl"
    `)) as unknown as { rows: any[] };
    const row = res.rows[0];
    if (!row) return fail('NOT_FOUND', 'Jadwal wawancara tidak ditemukan.', 404);

    try {
      const { syncApplicationTimeline } = await import('@/lib/services/timelineService');
      await syncApplicationTimeline(db, row.applicationId);
    } catch { /* opsional */ }

    return ok(row, 'Jadwal diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/interviews/[id]');
  }
}
```

- [ ] **Step 5: Create `src/components/governance/InterviewSchedulerPanel.tsx`**

`'use client'` component:
- Loads candidate applications with status `SCREENING`/`INTERVIEW` (from `GET /api/v1/recruitment/candidates`).
- Select application → form: `scheduledAt` (datetime-local), `durationMinutes` (default 45), `interviewerUserId` (optional select), `meetingUrl` (manual text).
- "Generate Ruang" button: calls a `POST /api/v1/recruitment/interviews/generate-room` stub **only if implemented**; otherwise show an informative toast "Buat link manual (Zoom/Meet) lalu tempel di kolom". Do not fabricate a provider.
- Submit → `POST /api/v1/recruitment/interviews` → then `PATCH /api/v1/recruitment/candidates/{id}/status` with `INTERVIEW`.
- List existing schedules for the selected application (`GET /api/v1/recruitment/interviews?applicationId=`) with a "Tandai Selesai" button → `PATCH /api/v1/recruitment/interviews/[id]` `{status:'DONE'}` and a "Batalkan" → `{status:'CANCELED'}`.
- Use the same Tailwind tokens as `RecruitmentPanel.tsx` (light card, accent `#007a5a`).

- [ ] **Step 6: Mount the panel in `src/app/dashboard/hr-command/page.tsx`**

Import `InterviewSchedulerPanel` and render it next to `RecruitmentPanel` (same card rhythm).

- [ ] **Step 7: Candidate "Jadwal Wawancara" card in `src/app/careers/portal/page.tsx`**

Add a card that shows the interview date/time, duration, interviewer, and a clickable meeting link when present. Consume the same data source chosen in Step 1 (prefer `/careers/status` timeline if it already exposes `meetingUrl`; otherwise add a minimal candidate `GET /api/v1/careers/interviews` and test it).

- [ ] **Step 8: Run the test — confirm it passes**

Same command as Step 3. Expected: PASS.

- [ ] **Step 9: Verify in the browser**

As HR: create a schedule with a meeting link, confirm the application moves to `INTERVIEW`. As the candidate: confirm the link appears in `/careers/portal` and `/careers/status`. As HR: click "Tandai Selesai" and confirm the schedule shows `DONE`.

- [ ] **Step 10: Commit**

```
git add src/app/api/v1/recruitment/interviews src/components/governance/InterviewSchedulerPanel.tsx src/app/dashboard/hr-command/page.tsx src/app/careers/portal/page.tsx tests/api/recruitment-interview-schedule.test.ts
git commit -m "feat(recruitment): HR interview scheduling with meeting link, mark-done, and candidate link visibility"
```

---

## Task 6 — F6: Full HR status control with notifications at every transition

**Files:**
- Modify: `src/lib/services/candidateService.ts` (`updateApplicationStatus`, `recordDecision` if present)
- Modify: `src/components/governance/RecruitmentPanel.tsx`
- Create: `tests/api/recruitment-status-notifications.test.ts`

**Interfaces:**
- Consumes: `updateApplicationStatus(db, applicationId, status)`; `recordDecision`; `notifyStageChange`; `application_status_enum`.
- Produces: notifications fire for **every** HR status change, including transitions that map to the same timeline stage (e.g. `OFFERED`→`HIRED` both map to `DECISION`). `updateApplicationStatus` gains an explicit notify on status change.

**The gap:** `updateApplicationStatus` only notifies indirectly through `upsertStage`, which sends only when the mapped timeline status actually changes. `OFFERED`→`HIRED` do not change the timeline status → no notification.

- [ ] **Step 1: Write the failing test `tests/api/recruitment-status-notifications.test.ts`**

HR-authenticated route test. Cover:
1. `PATCH /api/v1/recruitment/candidates/[id]/status` `{status:'SCREENING'}` creates a `candidate_notifications` row for the application.
2. Then `{status:'OFFERED'}` creates another notification row (count increases).
3. Then `{status:'HIRED'}` — because both map to `DECISION`, assert a **new** notification row is created (this is the regression the fix targets).

- [ ] **Step 2: Run the test — confirm it fails**

```
$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run tests/api/recruitment-status-notifications.test.ts --reporter=basic
```

Expected: FAIL on step 3 (no new notification for HIRED).

- [ ] **Step 3: Add explicit notification to `updateApplicationStatus`**

In `src/lib/services/candidateService.ts`, after a successful UPDATE (row present), notify based on the **application status** itself (not only the timeline stage):

```ts
if (row) {
  try {
    const { syncApplicationTimeline } = await import('@/lib/services/timelineService');
    await syncApplicationTimeline(db, applicationId);
  } catch { /* timeline opsional */ }

  try {
    const { notifyApplicationStatus } = await import('@/lib/services/notificationService');
    await notifyApplicationStatus(db, { applicationId, status });
  } catch (err) {
    console.warn('[candidateService] notifikasi status gagal:', (err as Error)?.message);
  }
}
```

Add `notifyApplicationStatus(db, { applicationId, status })` to `notificationService.ts` that writes ONE `candidate_notifications` row (+ best-effort email/WA) with copy tailored to the status (SCREENING = "lamaran Anda lolos seleksi awal", INTERVIEW = "jadwal wawancara", OFFERED = "penawaran kerja", HIRED = "selamat, Anda diterima", REJECTED = "lamaran belum berhasil"). Keep it idempotent-friendly (it may duplicate the timeline notification for stage-changing transitions — acceptable and preferable to silence; note this tradeoff in the commit body).

- [ ] **Step 4: Ensure `recordDecision` (OFFERED/REJECTED path) also notifies**

If `RecruitmentPanel` uses `POST /api/v1/recruitment/candidates/[id]/decision`, confirm that path also calls `updateApplicationStatus` (or notifies) so OFFERED/REJECTED emit a notification. If it bypasses `updateApplicationStatus`, add the same `notifyApplicationStatus` call there.

- [ ] **Step 5: Make the `RecruitmentPanel` dropdown cover the full lifecycle**

Confirm `STATUSES` in `src/components/governance/RecruitmentPanel.tsx` lists `SUBMITTED, SCREENING, INTERVIEW, OFFERED, HIRED, REJECTED`. When the HR picks `INTERVIEW`, show a hint pointing to the `InterviewSchedulerPanel` for the meeting link (do not silently allow INTERVIEW without a schedule; a soft hint is enough). Keep the existing review + decision buttons working.

- [ ] **Step 6: Run the test — confirm it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 7: Run the full suite + build**

```
$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run --reporter=basic
npm run build
```

Expected: all tests pass (existing 93 files + the 3 new ones), build succeeds.

- [ ] **Step 8: Commit**

```
git add src/lib/services/candidateService.ts src/lib/services/notificationService.ts src/components/governance/RecruitmentPanel.tsx tests/api/recruitment-status-notifications.test.ts
git commit -m "feat(recruitment): notify on every HR status transition incl. same-stage moves"
```

---

## Task 7 — End-to-end verification & docs

**Files:**
- Modify: `README.md` (flow section)
- Modify: `docs/decisions/` (add an ADR **only if** a schema change was made in Task 5)

- [ ] **Step 1: Reset the dev database and re-seed**

```
npm run db:reset; npm run db:seed
```

- [ ] **Step 2: Walk the full flow manually**

Register a candidate (`/careers/register`) → apply to a posting → receive application code + in-app/email/WA notification (or visible `FAILED` via health endpoint) → HR moves to `SCREENING` (candidate notified) → candidate starts psychometric + technical (previously locked) → HR reviews → HR schedules an interview with a meeting link (status → `INTERVIEW`, candidate notified with link) → candidate sees the link in `/careers/portal` and `/careers/status` → HR "Tandai Selesai" → HR sets `OFFERED` → `HIRED` → `REJECTED` used for a different applicant; each emits a notification.

- [ ] **Step 3: Add a "Alur Rekrutmen" section to `README.md`**

Document the end-to-end flow and the two operator prerequisites (verified `EMAIL_FROM` domain, active WA provider/token + `62…` phone).

- [ ] **Step 4: Full suite + build once more**

```
$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run --reporter=basic
npm run build
```

- [ ] **Step 5: Commit**

```
git add README.md docs/decisions
git commit -m "docs: document end-to-end recruitment flow and notification prerequisites"
```

---

## Self-Review Checklist

- [ ] Every task lists exact files and a failing-test → implement → pass → commit loop (except pure-styling Task 1/2, which use browser verification — acceptable per spec).
- [ ] No placeholders left in code snippets that ship; the one intentional placeholder (`EMAIL_FROM` domain) is explicitly labeled and documented.
- [ ] Status gating enforced in the service (`startAttempt`), not only the route/UI.
- [ ] Notifications never throw into the request path (all wrapped, all logged).
- [ ] No schema change unless strictly needed; if made, an ADR was added.
- [ ] Full suite + build green before the final commit.
- [ ] **No push performed.**
