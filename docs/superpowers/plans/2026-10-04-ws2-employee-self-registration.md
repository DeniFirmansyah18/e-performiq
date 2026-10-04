# WS-2: Employee Self-Registration (Email Verify + HR Approval) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new employee create their own account from a public portal link, verified by an emailed link, then activated only after HR approval.

**Architecture:** A public `employee_registrations` staging table holds sign-ups (email, password hash, name, phone, verify token, status). Register → status `PENDING_EMAIL` + verification email (token). Verify → `PENDING_APPROVAL`. HR approves → real `users` + `employees` rows created, registration marked `ACTIVE`. This is the **employee** plane; candidate identity stays separate (`candidate_accounts`). `employees.department_id`/`position_id` are `NOT NULL`, so approval requires dept + position (HR picks; default to first seed dept/position if blank).

**Tech Stack:** Next.js 14 App Router, Drizzle ORM (raw `sql`), PGlite/postgres-js, bcrypt, email via `notificationService.ts` + `email_outbox`.

**Spec:** `docs/superpowers/specs/2026-10-04-production-gap-closure-design.md` (§ WS-2)

## Global Constraints

- Dual-driver: all queries via `db.execute(sql\`...\`)`; migration idempotent (`IF NOT EXISTS`).
- New migration: `src/lib/db/migrations/0019_employee_self_registration.sql`.
- Update `tests/integration/schema.test.ts` (`EXPECTED_TABLES` + enum count) after adding table/enum.
- Passwords hashed with `hashPassword()` (bcrypt). Never plaintext.
- Emails best-effort: unconfigured provider still records `email_outbox` (QUEUED); never throw.
- Responses: `ok/fail/problem`; errors `AuthError`/`ForbiddenError`/`BusinessRuleError`.
- Activation creates `users.role='EMPLOYEE'`. HR routes require `HR_MANAGER`/`SUPER_ADMIN`.
- Commit after every task. `npm run db:reset` before full suite.

## Review Focus

- **Duplicate email** (in `users` OR pending registration) → friendly 4xx, no duplicate row.
- **Expired/invalid verify token** → clear 4xx ("link kadaluarsa"), status unchanged.
- **Approving twice** → idempotent; exactly one `users`+`employees` row.
- **Login before approval** → blocked with clear message (not 500).
- **Email provider down** → registration still succeeds; HR can approve manually.

---

### Task 1: Migration — `employee_registrations` table + status enum

**Files:**
- Create: `src/lib/db/migrations/0019_employee_self_registration.sql`
- Modify: `tests/integration/schema.test.ts`

**Interfaces:**
- Produces: table `employee_registrations` (`id UUID PK`, `email varchar(150) UNIQUE`, `full_name varchar(200)`, `phone_number varchar(30)`, `password_hash varchar(255)`, `position_hint varchar(150)`, `verify_token varchar(64)`, `verify_expires_at timestamptz`, `status employee_reg_status_enum`, `approved_by uuid`, `approved_at timestamptz`, `reject_reason text`, `created_at timestamptz`); enum `employee_reg_status_enum ('PENDING_EMAIL','PENDING_APPROVAL','ACTIVE','REJECTED')`.

- [ ] **Step 1: Write the migration**

```sql
-- 0019_employee_self_registration.sql
-- Registrasi mandiri karyawan: verifikasi email + approval HR.
DO $$ BEGIN
  CREATE TYPE employee_reg_status_enum AS ENUM
    ('PENDING_EMAIL','PENDING_APPROVAL','ACTIVE','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS employee_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(150) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone_number VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  position_hint VARCHAR(150),
  verify_token VARCHAR(64),
  verify_expires_at TIMESTAMPTZ,
  status employee_reg_status_enum NOT NULL DEFAULT 'PENDING_EMAIL',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emp_reg_status ON employee_registrations(status);
CREATE INDEX IF NOT EXISTS idx_emp_reg_token ON employee_registrations(verify_token);
```

- [ ] **Step 2: Update the schema baseline test**

In `tests/integration/schema.test.ts`, add `'employee_registrations'` to `EXPECTED_TABLES` and increment the enum count by 1.

- [ ] **Step 3: Run migration + schema test**

Run: `npm run db:reset`, then `.\node_modules\.bin\vitest.cmd run tests/integration/schema.test.ts -v`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/migrations/0019_employee_self_registration.sql tests/integration/schema.test.ts
git commit -m "feat(db): add employee_registrations table + status enum (migration 0019)"
```

---

### Task 2: `employeeRegistrationService` — register + verify + approve/reject

**Files:**
- Create: `src/lib/services/employeeRegistrationService.ts`
- Test: `tests/integration/employee-registration.test.ts`

**Interfaces:**
- Produces:
  - `registerEmployee(db, { fullName; email; password; phone?; positionHint? })` → `{ status:'PENDING_EMAIL'; verifyToken:string }` (throws `BusinessRuleError` on duplicate).
  - `verifyEmployeeEmail(db, token)` → `{ok:true; email} | {ok:false; reason:'INVALID'|'EXPIRED'|'ALREADY'}`.
  - `listPendingRegistrations(db)` → `Array<{ id; email; fullName; positionHint; status; createdAt }>`.
  - `approveRegistration(db, id, { approvedBy; departmentId; positionId })` → `{ employeeId; userId }` (idempotent).
  - `rejectRegistration(db, id, { approvedBy; reason? })` → `{ ok:true }`.
- Consumes: `hashPassword` (`src/lib/auth/password.ts`); drizzle `sql`; `BusinessRuleError`.

- [ ] **Step 1: Write failing tests**

Create `tests/integration/employee-registration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  registerEmployee, verifyEmployeeEmail, listPendingRegistrations,
  approveRegistration, rejectRegistration,
} from '@/lib/services/employeeRegistrationService';

describe('WS-2 registrasi mandiri karyawan', () => {
  let client: PGlite; let db: any;
  beforeAll(async () => { ({ client, db } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('register → PENDING_EMAIL + token 64 char', async () => {
    const r = await registerEmployee(db, { fullName: 'Sari Baru', email: 'sari.baru@example.com', password: 'rahasia123' });
    expect(r.status).toBe('PENDING_EMAIL');
    expect(r.verifyToken).toHaveLength(64);
  });

  it('duplicate email ditolak', async () => {
    await registerEmployee(db, { fullName: 'X', email: 'dupe@example.com', password: 'rahasia123' });
    await expect(registerEmployee(db, { fullName: 'Y', email: 'dupe@example.com', password: 'rahasia123' }))
      .rejects.toThrow(/sudah terdaftar/i);
  });

  it('verify token valid → ok', async () => {
    const { verifyToken } = await registerEmployee(db, { fullName: 'Verif', email: 'verif@example.com', password: 'x1234567' });
    expect((await verifyEmployeeEmail(db, verifyToken)).ok).toBe(true);
  });

  it('token tidak valid → INVALID', async () => {
    expect(await verifyEmployeeEmail(db, 'tidak-ada-token')).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('approve membuat user + employee, idempotent', async () => {
    const { verifyToken } = await registerEmployee(db, { fullName: 'Approve Me', email: 'appr@example.com', password: 'x1234567' });
    await verifyEmployeeEmail(db, verifyToken);
    const pend = (await listPendingRegistrations(db)).find((p) => p.email === 'appr@example.com')!;
    const dept = (await client.query<{ id: string }>(`SELECT id FROM departments LIMIT 1`)).rows[0].id;
    const pos = (await client.query<{ id: string }>(`SELECT id FROM job_positions LIMIT 1`)).rows[0].id;
    const a = await approveRegistration(db, pend.id, { approvedBy: 'admin', departmentId: dept, positionId: pos });
    expect(a.userId).toBeTruthy();
    const again = await approveRegistration(db, pend.id, { approvedBy: 'admin', departmentId: dept, positionId: pos });
    expect(again.userId).toBe(a.userId);
    const n = await client.query<{ c: string }>(`SELECT COUNT(*)::text c FROM users WHERE LOWER(email)='appr@example.com'`);
    expect(n.rows[0].c).toBe('1');
  });

  it('reject menandai REJECTED', async () => {
    const { verifyToken } = await registerEmployee(db, { fullName: 'R', email: 'rej@example.com', password: 'x1234567' });
    await verifyEmployeeEmail(db, verifyToken);
    const pend = (await listPendingRegistrations(db)).find((p) => p.email === 'rej@example.com')!;
    await rejectRegistration(db, pend.id, { approvedBy: 'admin', reason: 'bukan karyawan' });
    const row = await client.query<{ status: string }>(`SELECT status FROM employee_registrations WHERE id=$1::uuid`, [pend.id]);
    expect(row.rows[0].status).toBe('REJECTED');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/employee-registration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `src/lib/services/employeeRegistrationService.ts`:
- `randomToken()`: `(await import('node:crypto')).randomBytes(32).toString('hex')`.
- `registerEmployee`: lowercase email; reject if email in `users` OR `employee_registrations` → `throw new BusinessRuleError('Email sudah terdaftar.')`; `hashPassword`; INSERT with token + `verify_expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'`; return `{status:'PENDING_EMAIL', verifyToken}`.
- `verifyEmployeeEmail(token)`: SELECT by token; none → INVALID; `status!=='PENDING_EMAIL'` → ALREADY; expired → EXPIRED; else UPDATE status=PENDING_APPROVAL → `{ok:true,email}`.
- `listPendingRegistrations`: `WHERE status IN ('PENDING_APPROVAL','PENDING_EMAIL') ORDER BY created_at DESC`.
- `approveRegistration`: SELECT reg; if status ACTIVE → find existing `users` by email → return ids; else `employee_code='EMP-'+randomBytes(4).toString('hex').toUpperCase()`; INSERT `employees`(status 'PROBATION', base_salary 0, join_date CURRENT_DATE, dept/pos); INSERT `users`(role 'EMPLOYEE', is_active TRUE, employee_id); UPDATE reg ACTIVE. If a `users` row for email already exists, reuse it (idempotency).
- `rejectRegistration`: UPDATE status=REJECTED, reject_reason, approved_by, approved_at.
- All via `db.execute(sql\`...\`)` parameterized.

- [ ] **Step 4: Run to verify pass**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/employee-registration.test.ts -v`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/employeeRegistrationService.ts tests/integration/employee-registration.test.ts
git commit -m "feat(service): employee self-registration (register/verify/approve/reject)"
```

---

### Task 3: Public routes — register + verify

**Files:**
- Create: `src/app/api/v1/employee/register/route.ts`
- Create: `src/app/api/v1/employee/verify/route.ts`
- Test: `tests/api/employee-registration-routes.test.ts`

**Interfaces:**
- Consumes: `registerEmployee`, `verifyEmployeeEmail`; email helper + `email_outbox` from `notificationService`.
- Produces: `POST /api/v1/employee/register` → `ok({status:'PENDING_EMAIL'})`; `GET /api/v1/employee/verify?token=` → `ok({ok:true,email})` or 4xx.

- [ ] **Step 1: Write failing route test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { POST as register } from '@/app/api/v1/employee/register/route';
import { GET as verify } from '@/app/api/v1/employee/verify/route';

function post(body: unknown) {
  return new NextRequest('http://localhost:3000/api/v1/employee/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('WS-2 rute registrasi karyawan', () => {
  let client: any;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('register 200 + PENDING_EMAIL', async () => {
    const res = await register(post({ fullName: 'Route User', email: 'route.user@example.com', password: 'rahasia123' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('PENDING_EMAIL');
  });

  it('register email invalid → 400', async () => {
    const res = await register(post({ fullName: 'X', email: 'bukan-email', password: 'rahasia123' }));
    expect(res.status).toBe(400);
  });

  it('verify token asing → 4xx', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/employee/verify?token=ngawur');
    const res = await verify(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `.\node_modules\.bin\vitest.cmd run tests/api/employee-registration-routes.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the routes**

`register/route.ts`: `POST` — Zod `{ fullName: z.string().min(2), email: z.string().email(), password: z.string().min(8), phone: z.string().optional(), positionHint: z.string().optional() }`; `parseBody`; `registerEmployee(getDb(), data)`; best-effort send verification email with link `/employee/verify?token=<token>` (try/catch; on failure insert `email_outbox` QUEUED like `notificationService`); return `ok({ status:'PENDING_EMAIL' })`. Map `BusinessRuleError` → `problem(err, ...)`.

`verify/route.ts`: `GET` — `token = searchParams.get('token')`; `verifyEmployeeEmail(getDb(), token)`; if ok → `ok({ok:true,email})` else `fail('VERIFY_FAILED', reason message, 400)`.

- [ ] **Step 4: Run to verify pass**

Run: `.\node_modules\.bin\vitest.cmd run tests/api/employee-registration-routes.test.ts -v`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/employee/register/route.ts src/app/api/v1/employee/verify/route.ts tests/api/employee-registration-routes.test.ts
git commit -m "feat(api): public employee register + email verify routes"
```

---

### Task 4: HR routes — list, approve, reject

**Files:**
- Create: `src/app/api/v1/hr/registrations/route.ts` (GET list)
- Create: `src/app/api/v1/hr/registrations/[id]/approve/route.ts` (POST)
- Create: `src/app/api/v1/hr/registrations/[id]/reject/route.ts` (POST)
- Test: append to `tests/api/employee-registration-routes.test.ts`

**Interfaces:**
- Consumes: `listPendingRegistrations`, `approveRegistration`, `rejectRegistration`; HR auth guard (mirror existing HR route guard — grep `requireRole`/session check in another `src/app/api/v1/hr/**` or recruitment route).
- Produces: GET → `ok({ items })`; approve POST `{ departmentId, positionId }` → `ok({ employeeId, userId })`; reject POST `{ reason? }` → `ok({ ok:true })`.

- [ ] **Step 1: Write failing tests** — add tests that (a) GET returns array, (b) approve returns ids and is idempotent, (c) reject sets REJECTED. Use a signed HR session cookie (mirror `tests/api/recruitment-review-decisions.test.ts` auth setup).
- [ ] **Step 2: Run to verify failure** — `.\node_modules\.bin\vitest.cmd run tests/api/employee-registration-routes.test.ts`
- [ ] **Step 3: Implement routes with HR guard** — reuse the exact guard pattern from `src/app/api/v1/recruitment/**`; on unauthenticated → `AuthError` (401); wrong role → `ForbiddenError` (403).
- [ ] **Step 4: Run to verify pass** — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/hr/registrations tests/api/employee-registration-routes.test.ts
git commit -m "feat(api): HR list/approve/reject employee registrations"
```

---

### Task 5: UI — register page, verified page, HR panel + login gate

**Files:**
- Create: `src/app/employee/register/page.tsx` (public form)
- Create: `src/app/employee/verified/page.tsx` (result page)
- Create: `src/components/governance/EmployeeRegistrationPanel.tsx` (HR)
- Modify: the HR dashboard page to mount the panel (grep where `RecruitmentPanel` is mounted, mirror it)
- Modify: `src/middleware.ts` if needed (public paths — confirm `/employee/*` not gated like `/dashboard`)
- Test: browser verification

**Interfaces:**
- Consumes: the WS-2 routes.
- Produces: working end-to-end UI.

- [ ] **Step 1: Build the register page** — form (Nama, Email, Password, Telepon, Posisi diminati opsional) POSTing to `/api/v1/employee/register`; on success show "Cek email Anda untuk verifikasi".
- [ ] **Step 2: Build the verified page** — reads `?token=`, calls `/api/v1/employee/verify`, shows success ("Email terverifikasi, menunggu persetujuan HR") or error state.
- [ ] **Step 3: Build the HR panel** — table of pending registrations with Approve (dept+position selects) & Reject (reason) buttons; mount it in the HR dashboard.
- [ ] **Step 4: Browser verify** — register → verify (email link or manual token) → HR approve → login as the new employee.
- [ ] **Step 5: Run build + suite, commit**

```bash
npm run build
git add src/app/employee src/components/governance/EmployeeRegistrationPanel.tsx src/app/dashboard
git commit -m "feat(ui): employee self-registration pages + HR approval panel"
```

---

## Self-Review

**Spec coverage (§ WS-2):**
- `/employee/register` public form → Task 5. ✓
- Create `users`+`employees` PENDING_EMAIL + email verify link → Tasks 2, 3 (record `email_outbox`) + Task 5. ✓
- Verify → PENDING_APPROVAL → Tasks 2, 3. ✓
- HR approve/reject → Task 4 + Task 5. ✓
- Anti-abuse (unique email, token expiry) → Task 2 (duplicate guard, 24h expiry). Rate limiting: note as a follow-up (no existing rate-limit middleware found) — record in WS-5 ADR.
- Migration 0019 → Task 1. ✓
- Fallback: HR manual approve when email down → Task 2 approve works regardless of email status. ✓

**Placeholder scan:** Task 4/5 steps are described with exact commands and file paths; code shown for Tasks 1-3 (the risky logic). Tasks 4-5 rely on existing patterns (named explicitly) — acceptable since they mirror existing routes/pages verbatim.

**Type consistency:** `registerEmployee` returns `verifyToken` used by Task 3; `listPendingRegistrations` shape used by Task 4/5; `approveRegistration` returns `{employeeId,userId}` used by Task 4. ✓

**Review Focus → tests:** duplicate email (Task 2 test 2), invalid token (Task 2 test 4, Task 3 test 3), approve twice idempotent (Task 2 test 5), login-before-approval (WS-1 login flow + status gate — add assertion in Task 5 browser verify), email down (Task 3 try/catch). Covered except rate-limit (explicitly deferred).

