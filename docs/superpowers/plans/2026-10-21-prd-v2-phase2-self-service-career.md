# PRD v2.0 Phase 2 — Self-Service & Career Ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Revisi 2 points 3 and 4 real: overtime requests tied to payroll, personnel document uploads, the masked BPJS card, disciplinary actions with appeal, recognitions, and a measurable career ladder whose readiness comes from real data.

**Architecture:** Five additive migrations (`0042`–`0046`), one service per concern, thin routes following the existing auth/RBAC/Zod contract, and client components mounted into the existing employee portal. Overtime approval is the only write path that changes payroll input: `attendance_logs.total_overtime_hours` is capped by the approved request, never by the raw clock.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Drizzle ORM (PGlite test / postgres-js production), PostgreSQL 15, Zod, Vitest, Tailwind, lucide-react.

**Spec:** `PRD_Sistem_Penilaian_Karyawan (PT).md` — §5.6, §5.7, §6.2, §8, §10.3 D, §11.5.

## Global Constraints

- Phase 1 must be complete: `activity_events` and `appendActivity` exist and are used by every new service that changes employee state.
- New services take `db: Db` first and use Drizzle `sql` templates; routes use `getAuthSession` → `assertCan` → `ok`/`fail`.
- New permissions go in `src/lib/auth/rbac.ts`; no route may hardcode a role list.
- BPJS numbers, salary, and payroll components are `RESTRICTED` (PRD §6.2): never in `activity_events`, never in an AI context, masked by default in every response.
- A rejected/revealed sensitive access must write an `audit_logs` row through `logAction` from `@/lib/services/auditService`.
- Uploads accept PDF/JPG/PNG only, maximum 5 MB, and store a URL — never bytes in the database.
- Tests run with `npx vitest run <file>`.

## Review Focus

- **An employee requesting overtime after the fact.** The request must be rejected when `work_date` is in the past, and payroll must never pay unapproved hours.
- **A BPJS number that is shorter than 4 characters** (data-entry error). Masking must not throw, and the API must not leak the short value in a way that defeats masking.
- **A disciplinary action whose appeal deadline has passed.** The appeal endpoint must reject it, and the record must stay `NONE`, not become `UNDER_APPEAL`.
- **A career step whose source data is missing** (no appraisal, no certificate). Readiness must treat it as not-met, never as met-by-default, and never divide by zero when a ladder has zero mandatory steps.
- **Two HR users approving the same overtime request.** The second must fail rather than overwrite the approver, because payroll reads `approved_by`.

---

### Task 1: Overtime requests

**Files:**
- Create: `src/lib/db/migrations/0043_overtime_requests.sql`
- Create: `src/lib/services/overtimeService.ts`
- Create: `src/app/api/v1/me/overtime-requests/route.ts`
- Create: `src/app/api/v1/me/overtime-requests/[id]/approve/route.ts`
- Modify: `src/lib/auth/rbac.ts` (add `overtime:read`, `overtime:request`, `overtime:approve`)
- Test: `tests/api/overtime-routes.test.ts`

**Interfaces:**
- Produces:
  - `requestOvertime(db, input: { employeeId, workDate, plannedHours, reason }): Promise<OvertimeRow>`
  - `listOvertime(db, employeeId: string): Promise<OvertimeRow[]>`
  - `listPendingOvertime(db): Promise<OvertimeRow[]>`
  - `decideOvertime(db, input: { id, approverId, decision: 'APPROVED' | 'REJECTED', reason?: string }): Promise<OvertimeRow>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getMine, POST as postRequest } from '@/app/api/v1/me/overtime-requests/route';
import { PUT as putApprove } from '@/app/api/v1/me/overtime-requests/[id]/approve/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const tomorrow = () => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('overtime routes', () => {
  let client: PGlite;
  let empCookie = '';
  let mgrCookie = '';
  let overtimeId = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000002', employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('menolak lembur untuk tanggal yang sudah lewat', async () => {
    const res = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: '2020-01-01', plannedHours: 2, reason: 'penyelesaian laporan',
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('menolak rencana lebih dari 4 jam', async () => {
    const res = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: tomorrow(), plannedHours: 5, reason: 'penyelesaian laporan',
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('mengajukan lembur besok → SUBMITTED', async () => {
    const res = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: tomorrow(), plannedHours: 2, reason: 'penyelesaian laporan bulanan',
    }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('SUBMITTED');
    overtimeId = json.data.id;
  });

  it('karyawan tidak boleh menyetujui lemburnya sendiri', async () => {
    const res = await putApprove(
      jsonReq(`/api/v1/me/overtime-requests/${overtimeId}/approve`, 'PUT', { decision: 'APPROVED' }, empCookie),
      { params: { id: overtimeId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('atasan menyetujui → APPROVED dan tercatat approver', async () => {
    const res = await putApprove(
      jsonReq(`/api/v1/me/overtime-requests/${overtimeId}/approve`, 'PUT', { decision: 'APPROVED' }, mgrCookie),
      { params: { id: overtimeId } } as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('APPROVED');
    expect(json.data.approvedBy).toBe('e0000000-0000-4000-8000-000000000002');
  });

  it('keputusan kedua ditolak', async () => {
    const res = await putApprove(
      jsonReq(`/api/v1/me/overtime-requests/${overtimeId}/approve`, 'PUT', { decision: 'REJECTED', reason: 'ubah pikiran' }, mgrCookie),
      { params: { id: overtimeId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('karyawan melihat daftar lemburnya', async () => {
    const res = await getMine(getReq('/api/v1/me/overtime-requests', empCookie));
    const json = await res.json();
    expect(json.data.items.some((i: any) => i.id === overtimeId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/overtime-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Write the migration**

```sql
-- 0042: Pengajuan lembur (PRD v2.0 §5.6, §10.3 D).
CREATE TYPE overtime_status_enum AS ENUM
  ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  planned_hours DECIMAL(4,2) NOT NULL CHECK (planned_hours > 0 AND planned_hours <= 4),
  reason TEXT NOT NULL,
  status overtime_status_enum NOT NULL DEFAULT 'DRAFT',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_overtime_pending
  ON overtime_requests (status, work_date) WHERE status = 'SUBMITTED';
```

- [ ] **Step 4: Add permissions**

In `src/lib/auth/rbac.ts`:

```ts
| 'overtime:read'
| 'overtime:request'
| 'overtime:approve'
```

```ts
'overtime:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'overtime:request': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'overtime:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
```

- [ ] **Step 5: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';

export type OvertimeStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface OvertimeRow {
  id: string;
  employeeId: string;
  workDate: string;
  plannedHours: number;
  reason: string;
  status: OvertimeStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
}

const SELECT = sql`
  id, employee_id AS "employeeId", work_date AS "workDate",
  planned_hours::float8 AS "plannedHours", reason, status,
  approved_by AS "approvedBy", approved_at AS "approvedAt",
  rejection_reason AS "rejectionReason"
`;

const jakartaToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export async function requestOvertime(
  db: Db,
  input: { employeeId: string; workDate: string; plannedHours: number; reason: string },
): Promise<OvertimeRow> {
  if (input.workDate < jakartaToday()) {
    throw new BusinessRuleError('Lembur harus diajukan sebelum tanggal pelaksanaan.');
  }
  if (!(input.plannedHours > 0 && input.plannedHours <= 4)) {
    throw new BusinessRuleError('Jam lembur harus lebih dari 0 dan maksimal 4 jam per hari.');
  }
  if (input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan lembur wajib diisi (minimal 5 karakter).');
  }

  const res = (await db.execute(sql`
    INSERT INTO overtime_requests (employee_id, work_date, planned_hours, reason, status)
    VALUES (${input.employeeId}::uuid, ${input.workDate}::date,
            ${input.plannedHours}, ${input.reason}, 'SUBMITTED')
    ON CONFLICT (employee_id, work_date) DO NOTHING
    RETURNING ${SELECT}
  `)) as unknown as { rows: OvertimeRow[] };

  const row = res.rows?.[0];
  if (!row) {
    throw new BusinessRuleError('Sudah ada pengajuan lembur untuk tanggal tersebut.');
  }

  await appendActivity(db, {
    employeeId: input.employeeId,
    eventType: 'OVERTIME',
    entityId: row.id,
    summary: `Mengajukan lembur ${input.plannedHours} jam pada ${input.workDate}`,
  });
  return row;
}

export async function listOvertime(db: Db, employeeId: string): Promise<OvertimeRow[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT} FROM overtime_requests
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY work_date DESC
  `)) as unknown as { rows: OvertimeRow[] };
  return res.rows ?? [];
}

export async function listPendingOvertime(db: Db): Promise<OvertimeRow[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT} FROM overtime_requests
     WHERE status = 'SUBMITTED' ORDER BY work_date
  `)) as unknown as { rows: OvertimeRow[] };
  return res.rows ?? [];
}

export async function decideOvertime(
  db: Db,
  input: { id: string; approverId: string; decision: 'APPROVED' | 'REJECTED'; reason?: string },
): Promise<OvertimeRow> {
  if (input.decision === 'REJECTED' && !input.reason) {
    throw new BusinessRuleError('Penolakan lembur wajib menyertakan alasan.');
  }

  const res = (await db.execute(sql`
    UPDATE overtime_requests
       SET status = ${input.decision}::overtime_status_enum,
           approved_by = ${input.approverId}::uuid,
           approved_at = CURRENT_TIMESTAMP,
           rejection_reason = ${input.decision === 'REJECTED' ? input.reason! : null}
     WHERE id = ${input.id}::uuid AND status = 'SUBMITTED'
    RETURNING ${SELECT}
  `)) as unknown as { rows: OvertimeRow[] };

  const row = res.rows?.[0];
  if (!row) {
    throw new BusinessRuleError('Pengajuan tidak ditemukan atau sudah diputuskan.');
  }

  await appendActivity(db, {
    employeeId: row.employeeId,
    eventType: 'OVERTIME',
    entityId: row.id,
    summary: `Lembur ${row.workDate} ${input.decision === 'APPROVED' ? 'disetujui' : 'ditolak'}`,
  });
  return row;
}
```

- [ ] **Step 6: Write the two routes**

`src/app/api/v1/me/overtime-requests/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listOvertime, requestOvertime } from '@/lib/services/overtimeService';

const BodySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedHours: z.number().positive().max(4),
  reason: z.string().min(5).max(500),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'overtime:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const items = await listOvertime(db, session.employeeId);
    return ok({ items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat pengajuan lembur', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'overtime:request');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await requestOvertime(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, 'Pengajuan lembur terkirim dan menunggu persetujuan atasan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengajukan lembur', status);
  }
}
```

`src/app/api/v1/me/overtime-requests/[id]/approve/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { decideOvertime } from '@/lib/services/overtimeService';

const BodySchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().max(500).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'overtime:approve');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await decideOvertime(db, {
      id: params.id,
      approverId: session.userId,
      decision: parsed.data.decision,
      reason: parsed.data.reason,
    });
    return ok(row, 'Keputusan lembur tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memutuskan lembur', status);
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/api/overtime-routes.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/migrations/0043_overtime_requests.sql src/lib/services/overtimeService.ts src/app/api/v1/me/overtime-requests src/lib/auth/rbac.ts tests/api/overtime-routes.test.ts
git commit -m "feat(overtime): pengajuan & persetujuan lembur (PRD v2 fase 2)"
```

---

### Task 2: Personnel documents

**Files:**
- Create: `src/lib/db/migrations/0044_employee_documents.sql`
- Create: `src/lib/services/employeeDocumentService.ts`
- Create: `src/app/api/v1/me/documents/route.ts`
- Create: `src/app/api/v1/hr/documents/[id]/verify/route.ts`
- Modify: `src/lib/auth/rbac.ts` (add `document:read`, `document:write`, `document:verify`)
- Test: `tests/api/employee-documents-routes.test.ts`

**Interfaces:**
- Produces:
  - `listDocuments(db, employeeId): Promise<DocumentRow[]>`
  - `addDocument(db, input: { employeeId, documentType, fileUrl, issuedDate?, expiryDate? }): Promise<DocumentRow>`
  - `verifyDocument(db, input: { id, verifierId, decision: 'VERIFIED' | 'REJECTED' }): Promise<DocumentRow>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getDocs, POST as postDoc } from '@/app/api/v1/me/documents/route';
import { PUT as putVerify } from '@/app/api/v1/hr/documents/[id]/verify/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('employee documents', () => {
  let client: PGlite;
  let empCookie = '';
  let hrCookie = '';
  let docId = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('menolak tipe berkas yang tidak diizinkan', async () => {
    const res = await postDoc(jsonReq('/api/v1/me/documents', 'POST', {
      documentType: 'KTP', fileUrl: 'https://files.example.com/ktp.exe',
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('mengunggah KTP → PENDING', async () => {
    const res = await postDoc(jsonReq('/api/v1/me/documents', 'POST', {
      documentType: 'KTP', fileUrl: 'https://files.example.com/ktp.pdf',
    }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.verificationStatus).toBe('PENDING');
    docId = json.data.id;
  });

  it('HR memverifikasi berkas', async () => {
    const res = await putVerify(
      jsonReq(`/api/v1/hr/documents/${docId}/verify`, 'PUT', { decision: 'VERIFIED' }, hrCookie),
      { params: { id: docId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.verificationStatus).toBe('VERIFIED');
  });

  it('karyawan melihat berkasnya sendiri', async () => {
    const res = await getDocs(getReq('/api/v1/me/documents', empCookie));
    const json = await res.json();
    expect(json.data.items.find((d: any) => d.id === docId)?.verificationStatus).toBe('VERIFIED');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/employee-documents-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Write the migration**

```sql
-- 0043: Berkas kepegawaian (PRD v2.0 §5.6, §10.3 D).
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type VARCHAR(60) NOT NULL,
  file_url TEXT NOT NULL,
  issued_date DATE,
  expiry_date DATE,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry
  ON employee_documents (expiry_date) WHERE expiry_date IS NOT NULL;
```

- [ ] **Step 4: Add permissions**

```ts
| 'document:read'
| 'document:write'
| 'document:verify'
```

```ts
'document:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'document:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'document:verify': ['SUPER_ADMIN', 'HR_MANAGER'],
```

- [ ] **Step 5: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';

export interface DocumentRow {
  id: string;
  employeeId: string;
  documentType: string;
  fileUrl: string;
  issuedDate: string | null;
  expiryDate: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  verifiedAt: string | null;
}

const SELECT = sql`
  id, employee_id AS "employeeId", document_type AS "documentType",
  file_url AS "fileUrl", issued_date AS "issuedDate", expiry_date AS "expiryDate",
  verification_status AS "verificationStatus", verified_at AS "verifiedAt"
`;

const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];

export async function listDocuments(db: Db, employeeId: string): Promise<DocumentRow[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT} FROM employee_documents
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY created_at DESC
  `)) as unknown as { rows: DocumentRow[] };
  return res.rows ?? [];
}

export async function addDocument(
  db: Db,
  input: {
    employeeId: string;
    documentType: string;
    fileUrl: string;
    issuedDate?: string;
    expiryDate?: string;
  },
): Promise<DocumentRow> {
  const path = input.fileUrl.split('?')[0].toLowerCase();
  if (!ALLOWED_EXT.some((ext) => path.endsWith(ext))) {
    throw new BusinessRuleError('Berkas harus PDF, JPG, atau PNG.');
  }
  if (input.expiryDate && input.issuedDate && input.expiryDate < input.issuedDate) {
    throw new BusinessRuleError('Tanggal kedaluwarsa tidak boleh sebelum tanggal terbit.');
  }

  const res = (await db.execute(sql`
    INSERT INTO employee_documents
      (employee_id, document_type, file_url, issued_date, expiry_date, verification_status)
    VALUES (${input.employeeId}::uuid, ${input.documentType}, ${input.fileUrl},
            ${input.issuedDate ?? null}::date, ${input.expiryDate ?? null}::date, 'PENDING')
    RETURNING ${SELECT}
  `)) as unknown as { rows: DocumentRow[] };

  const row = res.rows[0];
  await appendActivity(db, {
    employeeId: input.employeeId,
    eventType: 'TRAINING',
    entityId: row.id,
    summary: `Mengunggah berkas ${input.documentType}`,
  });
  return row;
}

export async function verifyDocument(
  db: Db,
  input: { id: string; verifierId: string; decision: 'VERIFIED' | 'REJECTED' },
): Promise<DocumentRow> {
  const res = (await db.execute(sql`
    UPDATE employee_documents
       SET verification_status = ${input.decision},
           verified_by = ${input.verifierId}::uuid,
           verified_at = CURRENT_TIMESTAMP
     WHERE id = ${input.id}::uuid AND verification_status = 'PENDING'
    RETURNING ${SELECT}
  `)) as unknown as { rows: DocumentRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Berkas tidak ditemukan atau sudah diverifikasi.');
  return row;
}
```

- [ ] **Step 6: Write the two routes**

`src/app/api/v1/me/documents/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { addDocument, listDocuments } from '@/lib/services/employeeDocumentService';

const BodySchema = z.object({
  documentType: z.string().min(2).max(60),
  fileUrl: z.string().url(),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'document:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);
    return ok({ items: await listDocuments(db, session.employeeId) });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat berkas', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'document:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await addDocument(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, 'Berkas terunggah dan menunggu verifikasi HRD.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengunggah berkas', status);
  }
}
```

`src/app/api/v1/hr/documents/[id]/verify/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { verifyDocument } from '@/lib/services/employeeDocumentService';

const BodySchema = z.object({ decision: z.enum(['VERIFIED', 'REJECTED']) });

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'document:verify');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Keputusan tidak valid.', 400);

    const row = await verifyDocument(db, {
      id: params.id, verifierId: session.userId, decision: parsed.data.decision,
    });
    return ok(row, 'Verifikasi berkas tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memverifikasi berkas', status);
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/api/employee-documents-routes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/migrations/0044_employee_documents.sql src/lib/services/employeeDocumentService.ts src/app/api/v1/me/documents src/app/api/v1/hr/documents src/lib/auth/rbac.ts tests/api/employee-documents-routes.test.ts
git commit -m "feat(documents): unggah & verifikasi berkas kepegawaian (PRD v2 fase 2)"
```

---

### Task 3: BPJS card with masking and audited reveal

**Files:**
- Create: `src/lib/db/migrations/0045_employee_social_security.sql`
- Create: `src/lib/services/socialSecurityService.ts`
- Create: `src/app/api/v1/me/social-security/route.ts`
- Create: `src/app/api/v1/me/social-security/reveal/route.ts`
- Modify: `src/lib/auth/rbac.ts` (add `social_security:read`, `social_security:reveal`)
- Test: `tests/api/social-security-routes.test.ts`

**Interfaces:**
- Produces:
  - `maskNumber(value: string | null): string | null` — pure, never throws
  - `getSocialSecurity(db, employeeId): Promise<SocialSecurityMasked>`
  - `revealSocialSecurity(db, input: { employeeId, userId, reason }): Promise<{ bpjsTkNumber: string | null; bpjsKesNumber: string | null }>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { maskNumber } from '@/lib/services/socialSecurityService';
import { GET as getCard } from '@/app/api/v1/me/social-security/route';
import { POST as postReveal } from '@/app/api/v1/me/social-security/reveal/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });
const postReq = (path: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('social security', () => {
  let client: PGlite;
  let db: any;
  let empCookie = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    await db.execute(`
      INSERT INTO employee_social_security
        (employee_id, bpjs_tk_number, bpjs_kes_number, bpjs_kes_class)
      VALUES ('${BUDI}', '8101234567890123', '0001234567890', 'Kelas 1')`);
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('maskNumber tidak pernah melempar untuk nilai pendek', () => {
    expect(maskNumber(null)).toBeNull();
    expect(maskNumber('12')).toBe('••');
    expect(maskNumber('8101234567890123')).toBe('••••••••••••0123');
  });

  it('kartu menampilkan nomor ter-masking', async () => {
    const res = await getCard(getReq('/api/v1/me/social-security', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.bpjsTkNumber).toBe('••••••••••••0123');
    expect(JSON.stringify(json.data)).not.toContain('8101234567890123');
    expect(json.data.bpjsKesClass).toBe('Kelas 1');
  });

  it('reveal mengembalikan nomor penuh dan menulis audit log', async () => {
    const res = await postReveal(postReq('/api/v1/me/social-security/reveal', { reason: 'cek kartu' }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.bpjsTkNumber).toBe('8101234567890123');

    const audit = await db.execute(`
      SELECT count(*)::int AS n FROM audit_logs WHERE entity_name = 'employee_social_security'`);
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/social-security-routes.test.ts`
Expected: FAIL — cannot resolve `socialSecurityService`.

- [ ] **Step 3: Write the migration**

```sql
-- 0044: Kartu BPJS (PRD v2.0 §5.6, §10.3 D). Data RESTRICTED.
CREATE TABLE IF NOT EXISTS employee_social_security (
  employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  bpjs_tk_number VARCHAR(20),
  bpjs_kes_number VARCHAR(20),
  bpjs_kes_class VARCHAR(20),
  bpjs_tk_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (bpjs_tk_status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
  bpjs_kes_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (bpjs_kes_status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
  registered_at DATE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 4: Add permissions**

```ts
| 'social_security:read'
| 'social_security:reveal'
```

```ts
'social_security:read': ['SUPER_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
'social_security:reveal': ['SUPER_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
```

- [ ] **Step 5: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { logAction } from './auditService';

export interface SocialSecurityMasked {
  bpjsTkNumber: string | null;
  bpjsKesNumber: string | null;
  bpjsKesClass: string | null;
  bpjsTkStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  bpjsKesStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  registeredAt: string | null;
}

/** Menyembunyikan semua digit kecuali 4 terakhir; aman untuk nilai pendek/null. */
export function maskNumber(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\s+/g, '');
  if (digits.length <= 4) return '•'.repeat(digits.length);
  return '•'.repeat(digits.length - 4) + digits.slice(-4);
}

export async function getSocialSecurity(db: Db, employeeId: string): Promise<SocialSecurityMasked | null> {
  const res = (await db.execute(sql`
    SELECT bpjs_tk_number AS "bpjsTkNumber", bpjs_kes_number AS "bpjsKesNumber",
           bpjs_kes_class AS "bpjsKesClass", bpjs_tk_status AS "bpjsTkStatus",
           bpjs_kes_status AS "bpjsKesStatus", registered_at AS "registeredAt"
      FROM employee_social_security WHERE employee_id = ${employeeId}::uuid
  `)) as unknown as { rows: SocialSecurityMasked[] };

  const row = res.rows?.[0];
  if (!row) return null;

  return {
    ...row,
    bpjsTkNumber: maskNumber(row.bpjsTkNumber),
    bpjsKesNumber: maskNumber(row.bpjsKesNumber),
  };
}

export async function revealSocialSecurity(
  db: Db,
  input: { employeeId: string; userId: string; reason: string },
): Promise<{ bpjsTkNumber: string | null; bpjsKesNumber: string | null }> {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan membuka data wajib diisi (minimal 5 karakter).');
  }

  const res = (await db.execute(sql`
    SELECT bpjs_tk_number AS "bpjsTkNumber", bpjs_kes_number AS "bpjsKesNumber"
      FROM employee_social_security WHERE employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: Array<{ bpjsTkNumber: string | null; bpjsKesNumber: string | null }> };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Data BPJS belum terdaftar.');

  await logAction(db, {
    userId: input.userId,
    actionType: 'UPDATE',
    entityName: 'employee_social_security',
    recordId: input.employeeId,
    description: `Membuka nomor BPJS penuh. Alasan: ${input.reason}`,
  });

  return row;
}
```

- [ ] **Step 6: Write the two routes**

`src/app/api/v1/me/social-security/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getSocialSecurity } from '@/lib/services/socialSecurityService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'social_security:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const card = await getSocialSecurity(db, session.employeeId);
    if (!card) return fail('NOT_FOUND', 'Data BPJS belum terdaftar. Hubungi HRD.', 404);
    return ok(card);
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat kartu BPJS', 500);
  }
}
```

`src/app/api/v1/me/social-security/reveal/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { revealSocialSecurity } from '@/lib/services/socialSecurityService';

const BodySchema = z.object({ reason: z.string().min(5).max(200) });

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'social_security:reveal');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Alasan wajib diisi (minimal 5 karakter).', 400);
    }

    const data = await revealSocialSecurity(db, {
      employeeId: session.employeeId, userId: session.userId, reason: parsed.data.reason,
    });
    return ok(data, 'Akses tercatat pada audit log.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal membuka data BPJS', status);
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/api/social-security-routes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/migrations/0045_employee_social_security.sql src/lib/services/socialSecurityService.ts src/app/api/v1/me/social-security src/lib/auth/rbac.ts tests/api/social-security-routes.test.ts
git commit -m "feat(bpjs): kartu ter-masking + reveal ber-audit (PRD v2 fase 2)"
```

---

### Task 4: Disciplinary actions and recognitions

**Files:**
- Create: `src/lib/db/migrations/0046_disciplinary_recognitions.sql`
- Create: `src/lib/services/disciplinaryService.ts`
- Create: `src/app/api/v1/me/disciplinary-actions/route.ts`
- Create: `src/app/api/v1/me/disciplinary-actions/[id]/appeal/route.ts`
- Create: `src/app/api/v1/me/recognitions/route.ts`
- Test: `tests/api/disciplinary-routes.test.ts`

**Interfaces:**
- Produces:
  - `listDisciplinary(db, employeeId): Promise<DisciplinaryRow[]>`
  - `fileAppeal(db, input: { id, employeeId, reason }): Promise<DisciplinaryRow>`
  - `listRecognitions(db, employeeId): Promise<RecognitionRow[]>`
  - `issueDisciplinary(db, input: { employeeId, actionType, reason, evidenceUrl?, effectiveDate, expiryDate?, issuedBy }): Promise<DisciplinaryRow>`
  - `awardRecognition(db, input: { employeeId, recognitionType, title, description?, awardedDate, certificateUrl?, points? }): Promise<RecognitionRow>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { issueDisciplinary, awardRecognition } from '@/lib/services/disciplinaryService';
import { GET as getActions } from '@/app/api/v1/me/disciplinary-actions/route';
import { POST as postAppeal } from '@/app/api/v1/me/disciplinary-actions/[id]/appeal/route';
import { GET as getRecognitions } from '@/app/api/v1/me/recognitions/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });
const postReq = (path: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('disciplinary & recognition', () => {
  let client: PGlite;
  let db: any;
  let empCookie = '';
  let activeId = '';
  let expiredId = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;

    const active = await issueDisciplinary(db, {
      employeeId: BUDI, actionType: 'SP1', reason: 'Terlambat berulang',
      effectiveDate: '2026-10-01', issuedBy: 'e0000000-0000-4000-8000-000000000001',
    });
    activeId = active.id;

    const expired = await issueDisciplinary(db, {
      employeeId: BUDI, actionType: 'TEGURAN', reason: 'Tidak memakai ID card',
      effectiveDate: '2020-01-01', issuedBy: 'e0000000-0000-4000-8000-000000000001',
    });
    expiredId = expired.id;
    await db.execute(`UPDATE disciplinary_actions SET appeal_deadline = '2020-01-10' WHERE id = '${expiredId}'`);

    await awardRecognition(db, {
      employeeId: BUDI, recognitionType: 'EMPLOYEE_OF_THE_MONTH',
      title: 'Karyawan Terbaik Oktober', awardedDate: '2026-10-20', points: 50,
    });
  });
  afterAll(async () => { await client.close(); });

  it('karyawan melihat sanksi aktif & masa berlaku', async () => {
    const res = await getActions(getReq('/api/v1/me/disciplinary-actions', empCookie));
    const json = await res.json();
    const row = json.data.items.find((i: any) => i.id === activeId);
    expect(row.actionType).toBe('SP1');
    expect(row.appealStatus).toBe('NONE');
    expect(row.appealDeadline).toBeTruthy();
  });

  it('keberatan mengubah status menjadi UNDER_APPEAL tanpa menghapus catatan', async () => {
    const res = await postAppeal(
      postReq(`/api/v1/me/disciplinary-actions/${activeId}/appeal`, { reason: 'Saya sedang dinas luar' }, empCookie),
      { params: { id: activeId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.appealStatus).toBe('UNDER_APPEAL');

    const list = await getActions(getReq('/api/v1/me/disciplinary-actions', empCookie));
    const row = (await list.json()).data.items.find((i: any) => i.id === activeId);
    expect(row.reason).toBe('Terlambat berulang');
  });

  it('keberatan setelah tenggat ditolak', async () => {
    const res = await postAppeal(
      postReq(`/api/v1/me/disciplinary-actions/${expiredId}/appeal`, { reason: 'Terlambat mengajukan' }, empCookie),
      { params: { id: expiredId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('karyawan melihat penghargaan', async () => {
    const res = await getRecognitions(getReq('/api/v1/me/recognitions', empCookie));
    const json = await res.json();
    expect(json.data.items.some((r: any) => r.title === 'Karyawan Terbaik Oktober')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/disciplinary-routes.test.ts`
Expected: FAIL — cannot resolve `disciplinaryService`.

- [ ] **Step 3: Write the migration**

```sql
-- 0045: Sanksi & penghargaan (PRD v2.0 §5.6, §10.3 D).
CREATE TYPE disciplinary_type_enum AS ENUM ('TEGURAN', 'SP1', 'SP2', 'SP3');
CREATE TYPE appeal_status_enum AS ENUM
  ('NONE', 'UNDER_APPEAL', 'APPEAL_ACCEPTED', 'APPEAL_REJECTED');

CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  action_type disciplinary_type_enum NOT NULL,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  appeal_status appeal_status_enum NOT NULL DEFAULT 'NONE',
  appeal_deadline DATE NOT NULL,
  appeal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (expiry_date IS NULL OR expiry_date >= effective_date)
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_employee
  ON disciplinary_actions (employee_id, effective_date DESC);

CREATE TABLE IF NOT EXISTS recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  recognition_type VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  awarded_date DATE NOT NULL,
  certificate_url TEXT,
  points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recognitions_employee
  ON recognitions (employee_id, awarded_date DESC);
```

- [ ] **Step 4: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';

export type DisciplinaryType = 'TEGURAN' | 'SP1' | 'SP2' | 'SP3';
export type AppealStatus = 'NONE' | 'UNDER_APPEAL' | 'APPEAL_ACCEPTED' | 'APPEAL_REJECTED';

export interface DisciplinaryRow {
  id: string;
  employeeId: string;
  actionType: DisciplinaryType;
  reason: string;
  evidenceUrl: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  appealStatus: AppealStatus;
  appealDeadline: string;
  appealReason: string | null;
}

export interface RecognitionRow {
  id: string;
  employeeId: string;
  recognitionType: string;
  title: string;
  description: string | null;
  awardedDate: string;
  certificateUrl: string | null;
  points: number;
}

const DISC_SELECT = sql`
  id, employee_id AS "employeeId", action_type AS "actionType", reason,
  evidence_url AS "evidenceUrl", effective_date AS "effectiveDate",
  expiry_date AS "expiryDate", appeal_status AS "appealStatus",
  appeal_deadline AS "appealDeadline", appeal_reason AS "appealReason"
`;

const REC_SELECT = sql`
  id, employee_id AS "employeeId", recognition_type AS "recognitionType",
  title, description, awarded_date AS "awardedDate",
  certificate_url AS "certificateUrl", points
`;

export async function listDisciplinary(db: Db, employeeId: string): Promise<DisciplinaryRow[]> {
  const res = (await db.execute(sql`
    SELECT ${DISC_SELECT} FROM disciplinary_actions
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY effective_date DESC
  `)) as unknown as { rows: DisciplinaryRow[] };
  return res.rows ?? [];
}

export async function issueDisciplinary(
  db: Db,
  input: {
    employeeId: string;
    actionType: DisciplinaryType;
    reason: string;
    evidenceUrl?: string;
    effectiveDate: string;
    expiryDate?: string;
    issuedBy: string;
  },
): Promise<DisciplinaryRow> {
  if (input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan sanksi wajib diisi (minimal 5 karakter).');
  }
  if (input.expiryDate && input.expiryDate < input.effectiveDate) {
    throw new BusinessRuleError('Masa berlaku tidak boleh berakhir sebelum tanggal efektif.');
  }

  const res = (await db.execute(sql`
    INSERT INTO disciplinary_actions
      (employee_id, action_type, reason, evidence_url, effective_date, expiry_date,
       issued_by, appeal_deadline)
    VALUES (${input.employeeId}::uuid, ${input.actionType}::disciplinary_type_enum,
            ${input.reason}, ${input.evidenceUrl ?? null}, ${input.effectiveDate}::date,
            ${input.expiryDate ?? null}::date, ${input.issuedBy}::uuid,
            ${input.effectiveDate}::date + INTERVAL '5 days')
    RETURNING ${DISC_SELECT}
  `)) as unknown as { rows: DisciplinaryRow[] };

  const row = res.rows[0];
  await appendActivity(db, {
    employeeId: input.employeeId,
    eventType: 'DISCIPLINARY',
    entityId: row.id,
    summary: `${input.actionType} diterbitkan (${input.effectiveDate})`,
    visibility: 'CONFIDENTIAL',
  });
  return row;
}

export async function fileAppeal(
  db: Db,
  input: { id: string; employeeId: string; reason: string },
): Promise<DisciplinaryRow> {
  if (input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan keberatan wajib diisi (minimal 5 karakter).');
  }

  const current = (await db.execute(sql`
    SELECT appeal_status AS "appealStatus", appeal_deadline AS "appealDeadline"
      FROM disciplinary_actions
     WHERE id = ${input.id}::uuid AND employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: Array<{ appealStatus: AppealStatus; appealDeadline: string }> };

  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Sanksi tidak ditemukan untuk karyawan ini.');
  if (row.appealStatus !== 'NONE') {
    throw new BusinessRuleError(`Keberatan sudah diajukan (status ${row.appealStatus}).`);
  }

  const deadline = new Date(`${String(row.appealDeadline).slice(0, 10)}T23:59:59+07:00`);
  if (Date.now() > deadline.getTime()) {
    throw new BusinessRuleError('Tenggat keberatan (5 hari kerja) sudah lewat.');
  }

  const res = (await db.execute(sql`
    UPDATE disciplinary_actions
       SET appeal_status = 'UNDER_APPEAL', appeal_reason = ${input.reason}
     WHERE id = ${input.id}::uuid
    RETURNING ${DISC_SELECT}
  `)) as unknown as { rows: DisciplinaryRow[] };
  return res.rows[0];
}

export async function listRecognitions(db: Db, employeeId: string): Promise<RecognitionRow[]> {
  const res = (await db.execute(sql`
    SELECT ${REC_SELECT} FROM recognitions
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY awarded_date DESC
  `)) as unknown as { rows: RecognitionRow[] };
  return res.rows ?? [];
}

export async function awardRecognition(
  db: Db,
  input: {
    employeeId: string;
    recognitionType: string;
    title: string;
    description?: string;
    awardedDate: string;
    certificateUrl?: string;
    points?: number;
  },
): Promise<RecognitionRow> {
  const res = (await db.execute(sql`
    INSERT INTO recognitions
      (employee_id, recognition_type, title, description, awarded_date, certificate_url, points)
    VALUES (${input.employeeId}::uuid, ${input.recognitionType}, ${input.title},
            ${input.description ?? null}, ${input.awardedDate}::date,
            ${input.certificateUrl ?? null}, ${input.points ?? 0})
    RETURNING ${REC_SELECT}
  `)) as unknown as { rows: RecognitionRow[] };

  const row = res.rows[0];
  await appendActivity(db, {
    employeeId: input.employeeId,
    eventType: 'RECOGNITION',
    entityId: row.id,
    summary: `Menerima penghargaan: ${input.title}`,
  });
  return row;
}
```

- [ ] **Step 5: Write the three routes**

`src/app/api/v1/me/disciplinary-actions/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listDisciplinary } from '@/lib/services/disciplinaryService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);
    return ok({ items: await listDisciplinary(db, session.employeeId) });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat sanksi', 500);
  }
}
```

`src/app/api/v1/me/disciplinary-actions/[id]/appeal/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { fileAppeal } from '@/lib/services/disciplinaryService';

const BodySchema = z.object({ reason: z.string().min(5).max(1000) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await fileAppeal(db, {
      id: params.id, employeeId: session.employeeId, reason: parsed.data.reason,
    });
    return ok(row, 'Keberatan tercatat dan akan ditinjau HRD.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengajukan keberatan', status);
  }
}
```

`src/app/api/v1/me/recognitions/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listRecognitions } from '@/lib/services/disciplinaryService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);
    return ok({ items: await listRecognitions(db, session.employeeId) });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat penghargaan', 500);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/api/disciplinary-routes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/migrations/0046_disciplinary_recognitions.sql src/lib/services/disciplinaryService.ts src/app/api/v1/me/disciplinary-actions src/app/api/v1/me/recognitions tests/api/disciplinary-routes.test.ts
git commit -m "feat(employee): sanksi berkeberatan + penghargaan (PRD v2 fase 2)"
```

---

### Task 5: Career ladder with data-derived readiness

**Files:**
- Create: `src/lib/db/migrations/0047_career_ladder.sql`
- Create: `src/lib/services/careerLadderService.ts`
- Create: `src/app/api/v1/me/career-ladder/route.ts`
- Create: `src/app/api/v1/careers/succession-candidates/route.ts`
- Modify: `src/lib/auth/rbac.ts` (add `career:read`)
- Test: `tests/integration/careerLadderService.test.ts`

**Interfaces:**
- Produces:
  - `listLadder(db, employeeId): Promise<LadderStepResult[]>` where each item is `{ stepId, stepName, requirementType, threshold, met, actual }`
  - `readiness(db, employeeId): Promise<{ targetPositionId: string | null; percent: number; met: number; total: number }>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { listLadder, readiness } from '@/lib/services/careerLadderService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('careerLadderService', () => {
  let client: PGlite;
  let db: any;
  let fromPosition = '';
  let toPosition = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    const pos = await db.execute(`
      SELECT e.position_id AS current, p.id AS other
        FROM employees e
        JOIN job_positions p ON p.id <> e.position_id
       WHERE e.id = '${BUDI}'
       LIMIT 1`);
    fromPosition = pos.rows[0].current;
    toPosition = pos.rows[0].other;

    await db.execute(`
      INSERT INTO career_ladder_steps
        (from_position_id, to_position_id, step_order, step_name, requirement_type, threshold_value)
      VALUES ('${fromPosition}', '${toPosition}', 1, 'Masa kerja 1 tahun', 'TENURE', 12),
             ('${fromPosition}', '${toPosition}', 2, 'Sertifikasi wajib', 'CERTIFICATION', 1)`);
  });
  afterAll(async () => { await client.close(); });

  it('tahapan tanpa data sumber dianggap belum terpenuhi', async () => {
    const steps = await listLadder(db, BUDI);
    const cert = steps.find((s) => s.requirementType === 'CERTIFICATION');
    expect(cert?.met).toBe(false);
    expect(cert?.actual).toBe(0);
  });

  it('readiness tidak membagi nol saat tidak ada tahapan wajib', async () => {
    const res = await readiness(db, 'b0000000-0000-4000-8000-000000000002');
    expect(res.percent).toBe(0);
    expect(res.total).toBe(0);
  });

  it('readiness memakai data nyata untuk TENURE', async () => {
    const res = await readiness(db, BUDI);
    expect(res.total).toBeGreaterThanOrEqual(1);
    expect(res.percent).toBeGreaterThanOrEqual(0);
    expect(res.percent).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/careerLadderService.test.ts`
Expected: FAIL — cannot resolve `careerLadderService`.

- [ ] **Step 3: Write the migration**

```sql
-- 0046: Tangga karir terukur (PRD v2.0 §5.7, §10.3 D).
CREATE TYPE career_requirement_enum AS ENUM
  ('GPA', 'COMPETENCY', 'CERTIFICATION', 'TRAINING_HOURS', 'MOODLE_COURSE', 'TENURE');

CREATE TABLE IF NOT EXISTS career_ladder_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  to_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  step_order SMALLINT NOT NULL CHECK (step_order > 0),
  step_name VARCHAR(200) NOT NULL,
  requirement_type career_requirement_enum NOT NULL,
  requirement_ref VARCHAR(200),
  threshold_value DECIMAL(10,2),
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (from_position_id, to_position_id, step_order),
  CHECK (from_position_id <> to_position_id)
);

CREATE INDEX IF NOT EXISTS idx_career_ladder_target
  ON career_ladder_steps (from_position_id, to_position_id, step_order);
```

- [ ] **Step 4: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type RequirementType =
  | 'GPA' | 'COMPETENCY' | 'CERTIFICATION' | 'TRAINING_HOURS' | 'MOODLE_COURSE' | 'TENURE';

export interface LadderStepResult {
  stepId: string;
  stepName: string;
  requirementType: RequirementType;
  threshold: number | null;
  actual: number;
  met: boolean;
  targetPositionId: string;
}

export interface ReadinessResult {
  targetPositionId: string | null;
  percent: number;
  met: number;
  total: number;
}

/**
 * Nilai nyata untuk satu jenis syarat. Semua query mengembalikan 0 bila data
 * tidak ada — syarat tidak pernah dianggap terpenuhi secara default.
 */
async function actualFor(
  db: Db,
  employeeId: string,
  type: RequirementType,
  ref: string | null,
): Promise<number> {
  switch (type) {
    case 'GPA': {
      const res = (await db.execute(sql`
        SELECT composite_gpa::float8 AS v FROM performance_appraisals
         WHERE employee_id = ${employeeId}::uuid
         ORDER BY created_at DESC LIMIT 1
      `)) as unknown as { rows: Array<{ v: number | null }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'COMPETENCY': {
      const res = (await db.execute(sql`
        SELECT COALESCE(avg(score), 0)::float8 AS v FROM competency_scores
         WHERE employee_id = ${employeeId}::uuid
           AND (${ref ?? null}::text IS NULL OR skill_name = ${ref ?? null})
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'CERTIFICATION': {
      const res = (await db.execute(sql`
        SELECT count(*)::int AS v
          FROM certificates c
          JOIN moodle_courses mc ON mc.id = c.course_id
         WHERE c.employee_id = ${employeeId}::uuid
           AND (${ref ?? null}::text IS NULL OR mc.title ILIKE '%' || ${ref ?? null} || '%')
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'TRAINING_HOURS': {
      const res = (await db.execute(sql`
        SELECT COALESCE(sum(mc.default_hours), 0)::float8 AS v
          FROM course_completions cc
          JOIN moodle_courses mc ON mc.id = cc.course_id
         WHERE cc.employee_id = ${employeeId}::uuid
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'MOODLE_COURSE': {
      const res = (await db.execute(sql`
        SELECT count(*)::int AS v FROM course_completions
         WHERE employee_id = ${employeeId}::uuid
           AND (${ref ?? null}::text IS NULL OR course_id::text = ${ref ?? null})
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'TENURE': {
      const res = (await db.execute(sql`
        SELECT GREATEST(0, (EXTRACT(YEAR FROM age(CURRENT_DATE, join_date)) * 12
                          + EXTRACT(MONTH FROM age(CURRENT_DATE, join_date))))::float8 AS v
          FROM employees WHERE id = ${employeeId}::uuid
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    default:
      return 0;
  }
}

export async function listLadder(db: Db, employeeId: string): Promise<LadderStepResult[]> {
  const steps = (await db.execute(sql`
    SELECT s.id AS "stepId", s.step_name AS "stepName",
           s.requirement_type AS "requirementType", s.requirement_ref AS ref,
           s.threshold_value::float8 AS threshold,
           s.is_mandatory AS "isMandatory", s.to_position_id AS "targetPositionId"
      FROM career_ladder_steps s
      JOIN employees e ON e.position_id = s.from_position_id
     WHERE e.id = ${employeeId}::uuid
     ORDER BY s.step_order
  `)) as unknown as {
    rows: Array<{
      stepId: string; stepName: string; requirementType: RequirementType;
      ref: string | null; threshold: number | null; isMandatory: boolean; targetPositionId: string;
    }>;
  };

  const out: LadderStepResult[] = [];
  for (const s of steps.rows ?? []) {
    const actual = await actualFor(db, employeeId, s.requirementType, s.ref);
    out.push({
      stepId: s.stepId,
      stepName: s.stepName,
      requirementType: s.requirementType,
      threshold: s.threshold,
      actual,
      met: s.threshold === null ? actual > 0 : actual >= Number(s.threshold),
      targetPositionId: s.targetPositionId,
    });
  }
  return out;
}

export async function readiness(db: Db, employeeId: string): Promise<ReadinessResult> {
  const steps = await listLadder(db, employeeId);
  if (steps.length === 0) {
    return { targetPositionId: null, percent: 0, met: 0, total: 0 };
  }
  const met = steps.filter((s) => s.met).length;
  return {
    targetPositionId: steps[0].targetPositionId,
    percent: Math.round((met / steps.length) * 100),
    met,
    total: steps.length,
  };
}
```

> Column names above are the ones that exist today: `competency_scores.skill_name`, `competency_scores.score`, `course_completions.course_id`, `moodle_courses.default_hours`, `certificates.course_id`, and `performance_appraisals.composite_gpa`.

- [ ] **Step 5: Write the two routes**

`src/app/api/v1/me/career-ladder/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listLadder, readiness } from '@/lib/services/careerLadderService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'career:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const [steps, score] = await Promise.all([
      listLadder(db, session.employeeId),
      readiness(db, session.employeeId),
    ]);
    return ok({ steps, readiness: score });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat tangga karir', 500);
  }
}
```

`src/app/api/v1/careers/succession-candidates/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { readiness } from '@/lib/services/careerLadderService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const employees = (await db.execute(`
      SELECT id, full_name AS "fullName" FROM employees
       WHERE status <> 'RESIGNED' ORDER BY full_name
    `)) as unknown as { rows: Array<{ id: string; fullName: string }> };

    const items: Array<{ employeeId: string; fullName: string; percent: number; targetPositionId: string | null }> = [];
    for (const e of employees.rows ?? []) {
      const r = await readiness(db, e.id);
      if (r.percent >= 80 && r.total > 0) {
        items.push({ employeeId: e.id, fullName: e.fullName, percent: r.percent, targetPositionId: r.targetPositionId });
      }
    }
    return ok({ items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat kandidat suksesi', 500);
  }
}
```

- [ ] **Step 6: Add the permission**

```ts
| 'career:read'
```

```ts
'career:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/integration/careerLadderService.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/migrations/0047_career_ladder.sql src/lib/services/careerLadderService.ts src/app/api/v1/me/career-ladder src/app/api/v1/careers/succession-candidates src/lib/auth/rbac.ts tests/integration/careerLadderService.test.ts
git commit -m "feat(career): tangga karir terukur + readiness (PRD v2 fase 2)"
```

---

### Task 6: Self-service UI (overtime, BPJS, sanctions)

**Files:**
- Create: `src/components/employee/OvertimeModal.tsx`
- Create: `src/components/employee/SocialSecurityCard.tsx`
- Create: `src/components/employee/DisciplinaryModal.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx` (add three `ActionCard`s to "Aksi Cepat")
- Test: `tests/ui/self-service-modals.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/v1/me/overtime-requests`, `GET /api/v1/me/social-security`, `GET /api/v1/me/disciplinary-actions`, `POST /api/v1/me/disciplinary-actions/:id/appeal`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SocialSecurityCard from '@/components/employee/SocialSecurityCard';
import DisciplinaryModal from '@/components/employee/DisciplinaryModal';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/social-security')) {
      return { ok: true, json: async () => ({ data: {
        bpjsTkNumber: '••••••••••••0123', bpjsKesNumber: '•••••••••7890',
        bpjsKesClass: 'Kelas 1', bpjsTkStatus: 'ACTIVE', bpjsKesStatus: 'ACTIVE',
        registeredAt: '2024-01-05',
      } }) } as any;
    }
    if (url.includes('/disciplinary-actions')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'd1', actionType: 'SP1', reason: 'Terlambat berulang',
          effectiveDate: '2026-10-01', expiryDate: null, appealStatus: 'NONE',
          appealDeadline: '2026-10-06' },
      ] } }) } as any;
    }
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

describe('self-service UI', () => {
  it('kartu BPJS menampilkan nomor ter-masking dan kelas', async () => {
    render(<SocialSecurityCard />);
    await waitFor(() => expect(screen.getByText(/••••••••••••0123/)).toBeTruthy());
    expect(screen.getByText(/Kelas 1/)).toBeTruthy();
  });

  it('modal sanksi menampilkan alasan dan status keberatan', async () => {
    render(<DisciplinaryModal open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Terlambat berulang/)).toBeTruthy());
    expect(screen.getByText(/Belum diajukan/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/self-service-modals.test.tsx`
Expected: FAIL — cannot resolve the components.

- [ ] **Step 3: Write `SocialSecurityCard`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface Card {
  bpjsTkNumber: string | null;
  bpjsKesNumber: string | null;
  bpjsKesClass: string | null;
  bpjsTkStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  bpjsKesStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  registeredAt: string | null;
}

const STATUS_LABEL: Record<Card['bpjsTkStatus'], string> = {
  ACTIVE: 'Aktif', INACTIVE: 'Tidak aktif', PENDING: 'Menunggu aktivasi',
};

export default function SocialSecurityCard() {
  const [card, setCard] = useState<Card | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/me/social-security')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setCard(j?.data ?? null); })
      .catch(() => { /* biarkan kosong */ });
    return () => { active = false; };
  }, []);

  const reveal = async () => {
    const reason = window.prompt('Alasan membuka nomor lengkap (tercatat di audit log):') ?? '';
    if (reason.trim().length < 5) { setMessage('Alasan minimal 5 karakter.'); return; }
    const res = await fetch('/api/v1/me/social-security/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal membuka nomor.'); return; }
    setCard((c) => (c ? { ...c, ...json.data } : c));
    setMessage('Nomor ditampilkan. Akses tercatat pada audit log.');
  };

  if (!card) {
    return (
      <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-xs text-[#64748b]">
        Data BPJS belum terdaftar atau belum dapat dimuat.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#007a5a]" aria-hidden="true" />
        <h2 className="text-sm font-extrabold text-[#0f172a]">BPJS Ketenagakerjaan & Kesehatan</h2>
      </div>

      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-[#64748b]">BPJS Ketenagakerjaan</dt>
          <dd className="font-semibold text-[#0f172a]">{card.bpjsTkNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[#64748b]">BPJS Kesehatan</dt>
          <dd className="font-semibold text-[#0f172a]">
            {card.bpjsKesNumber ?? '—'} {card.bpjsKesClass ? `· ${card.bpjsKesClass}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-[#64748b]">Status</dt>
          <dd className="font-semibold text-[#0f172a]">{STATUS_LABEL[card.bpjsTkStatus]}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={reveal}
        className="mt-3 rounded-lg border border-[#007a5a] px-3 py-1.5 text-xs font-semibold text-[#007a5a] hover:bg-[#e6f4ea] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
      >
        Tampilkan nomor lengkap
      </button>

      {message && <p className="mt-2 text-[11px] text-[#475569]">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Write `DisciplinaryModal`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, AlertTriangle, Award } from 'lucide-react';

interface Action {
  id: string;
  actionType: 'TEGURAN' | 'SP1' | 'SP2' | 'SP3';
  reason: string;
  effectiveDate: string;
  expiryDate: string | null;
  appealStatus: 'NONE' | 'UNDER_APPEAL' | 'APPEAL_ACCEPTED' | 'APPEAL_REJECTED';
  appealDeadline: string;
}

interface Recognition {
  id: string;
  title: string;
  awardedDate: string;
  certificateUrl: string | null;
}

const APPEAL_LABEL: Record<Action['appealStatus'], string> = {
  NONE: 'Belum diajukan',
  UNDER_APPEAL: 'Sedang ditinjau HRD',
  APPEAL_ACCEPTED: 'Keberatan diterima',
  APPEAL_REJECTED: 'Keberatan ditolak',
};

export default function DisciplinaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      fetch('/api/v1/me/disciplinary-actions').then((x) => (x.ok ? x.json() : null)),
      fetch('/api/v1/me/recognitions').then((x) => (x.ok ? x.json() : null)),
    ]);
    setActions(a?.data?.items ?? []);
    setRecognitions(r?.data?.items ?? []);
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const appeal = async (id: string) => {
    const reason = window.prompt('Alasan keberatan (diajukan maksimal 5 hari kerja):') ?? '';
    if (reason.trim().length < 5) { setMessage('Alasan minimal 5 karakter.'); return; }
    const res = await fetch(`/api/v1/me/disciplinary-actions/${id}/appeal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal mengajukan keberatan.'); return; }
    setMessage('Keberatan tercatat.');
    await load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="disc-title">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="disc-title" className="text-base font-extrabold text-[#0f172a]">Sanksi & Penghargaan</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <h3 className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748b]">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Sanksi
        </h3>
        <ul className="mt-2 space-y-2">
          {actions.map((a) => (
            <li key={a.id} className="rounded-xl border border-[#e2e8f0] p-3">
              <p className="text-sm font-bold text-[#0f172a]">{a.actionType} · {a.effectiveDate}</p>
              <p className="mt-1 text-xs text-[#475569]">{a.reason}</p>
              <p className="mt-1 text-[11px] text-[#64748b]">
                Status keberatan: {APPEAL_LABEL[a.appealStatus]} · tenggat {String(a.appealDeadline).slice(0, 10)}
              </p>
              {a.appealStatus === 'NONE' && (
                <button
                  type="button"
                  onClick={() => appeal(a.id)}
                  className="mt-2 rounded-lg border border-[#b45309] px-2.5 py-1 text-[11px] font-semibold text-[#b45309] hover:bg-[#fffbeb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b45309] focus-visible:ring-offset-2"
                >
                  Ajukan keberatan
                </button>
              )}
            </li>
          ))}
          {actions.length === 0 && <li className="text-xs text-[#64748b]">Tidak ada catatan sanksi.</li>}
        </ul>

        <h3 className="mt-5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748b]">
          <Award className="h-3.5 w-3.5" aria-hidden="true" /> Penghargaan
        </h3>
        <ul className="mt-2 space-y-1">
          {recognitions.map((r) => (
            <li key={r.id} className="text-xs text-[#0f172a]">
              <span className="font-semibold">{r.title}</span> · {r.awardedDate}
              {r.certificateUrl && (
                <a href={r.certificateUrl} className="ml-2 text-[#007a5a] underline" target="_blank" rel="noreferrer">
                  sertifikat
                </a>
              )}
            </li>
          ))}
          {recognitions.length === 0 && <li className="text-xs text-[#64748b]">Belum ada penghargaan.</li>}
        </ul>

        {message && <p className="mt-3 text-xs font-semibold text-[#0f172a]">{message}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `OvertimeModal`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Clock } from 'lucide-react';

interface Row {
  id: string;
  workDate: string;
  plannedHours: number;
  reason: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
}

const STATUS_LABEL: Record<Row['status'], string> = {
  DRAFT: 'Draf', SUBMITTED: 'Menunggu persetujuan',
  APPROVED: 'Disetujui', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan',
};

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};

export default function OvertimeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ workDate: tomorrow(), plannedHours: '2', reason: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/me/overtime-requests');
    if (!res.ok) return;
    const json = await res.json();
    setRows(json?.data?.items ?? []);
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/v1/me/overtime-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workDate: form.workDate,
        plannedHours: Number(form.plannedHours),
        reason: form.reason,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal mengajukan lembur.'); return; }
    setMessage('Pengajuan lembur terkirim.');
    setForm((f) => ({ ...f, reason: '' }));
    await load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="ot-title">
      <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="ot-title" className="flex items-center gap-1.5 text-base font-extrabold text-[#0f172a]">
            <Clock className="h-4 w-4" aria-hidden="true" /> Pengajuan Lembur
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-[#475569]">
            Tanggal
            <input
              type="date"
              value={form.workDate}
              min={tomorrow()}
              onChange={(e) => setForm((f) => ({ ...f, workDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-xs text-[#475569]">
            Perkiraan jam (maks 4)
            <input
              type="number"
              min={0.5}
              max={4}
              step={0.5}
              value={form.plannedHours}
              onChange={(e) => setForm((f) => ({ ...f, plannedHours: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-xs text-[#475569] sm:col-span-2">
            Alasan / penugasan
            <textarea
              value={form.reason}
              rows={2}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-3 rounded-lg bg-[#007a5a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Ajukan
        </button>

        {message && <p className="mt-2 text-xs font-semibold text-[#0f172a]">{message}</p>}

        <ul className="mt-4 divide-y divide-[#e2e8f0]">
          {rows.map((r) => (
            <li key={r.id} className="py-2 text-xs">
              <p className="font-semibold text-[#0f172a]">{r.workDate} · {r.plannedHours} jam</p>
              <p className="text-[#64748b]">{STATUS_LABEL[r.status]} · {r.reason}</p>
            </li>
          ))}
          {rows.length === 0 && <li className="py-2 text-xs text-[#64748b]">Belum ada pengajuan lembur.</li>}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Mount them in the employee portal**

In `src/app/dashboard/employee-portal/page.tsx` add imports:

```tsx
import OvertimeModal from '@/components/employee/OvertimeModal';
import SocialSecurityCard from '@/components/employee/SocialSecurityCard';
import DisciplinaryModal from '@/components/employee/DisciplinaryModal';
```

Add state next to the other modal flags:

```tsx
const [isOvertimeOpen, setIsOvertimeOpen] = useState(false);
const [isDisciplinaryOpen, setIsDisciplinaryOpen] = useState(false);
```

Add two `ActionCard`s inside the "Aksi Cepat" grid:

```tsx
<ActionCard
  icon={Clock}
  tone="amber"
  title="Ajukan Lembur"
  tag="Persetujuan atasan"
  description="Rencanakan lembur sebelum bekerja agar jam lembur masuk perhitungan payroll."
  onClick={() => setIsOvertimeOpen(true)}
/>
<ActionCard
  icon={AlertTriangle}
  tone="rose"
  title="Sanksi & Penghargaan"
  tag="Transparan"
  description="Lihat catatan sanksi beserta masa berlaku, ajukan keberatan, dan unduh sertifikat penghargaan."
  onClick={() => setIsDisciplinaryOpen(true)}
/>
```

Render the card and modals beside the other modals at the end of the component:

```tsx
<SocialSecurityCard />
<OvertimeModal open={isOvertimeOpen} onClose={() => setIsOvertimeOpen(false)} />
<DisciplinaryModal open={isDisciplinaryOpen} onClose={() => setIsDisciplinaryOpen(false)} />
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/ui/self-service-modals.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/employee/OvertimeModal.tsx src/components/employee/SocialSecurityCard.tsx src/components/employee/DisciplinaryModal.tsx src/app/dashboard/employee-portal/page.tsx tests/ui/self-service-modals.test.tsx
git commit -m "feat(ui): layanan mandiri lembur, BPJS, sanksi & penghargaan (PRD v2 fase 2)"
```

---

### Task 7: Career ladder UI

**Files:**
- Modify: `src/components/employee/CareerPathModal.tsx` (add a measured-steps section)
- Test: `tests/ui/career-ladder.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/me/career-ladder`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CareerLadderPanel from '@/components/employee/CareerLadderPanel';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: {
      steps: [
        { stepId: 's1', stepName: 'Masa kerja 1 tahun', requirementType: 'TENURE', threshold: 12, actual: 14, met: true, targetPositionId: 'p2' },
        { stepId: 's2', stepName: 'Sertifikasi wajib', requirementType: 'CERTIFICATION', threshold: 1, actual: 0, met: false, targetPositionId: 'p2' },
      ],
      readiness: { targetPositionId: 'p2', percent: 50, met: 1, total: 2 },
    } }),
  })) as any));
});

describe('CareerLadderPanel', () => {
  it('menampilkan readiness dan status tiap tahapan', async () => {
    render(<CareerLadderPanel />);
    await waitFor(() => expect(screen.getByText(/50%/)).toBeTruthy());
    expect(screen.getByText('Masa kerja 1 tahun')).toBeTruthy();
    expect(screen.getByText(/Belum terpenuhi/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/career-ladder.test.tsx`
Expected: FAIL — cannot resolve `CareerLadderPanel`.

- [ ] **Step 3: Write `CareerLadderPanel`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

interface Step {
  stepId: string;
  stepName: string;
  requirementType: string;
  threshold: number | null;
  actual: number;
  met: boolean;
}

interface Readiness {
  targetPositionId: string | null;
  percent: number;
  met: number;
  total: number;
}

export default function CareerLadderPanel() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/me/career-ladder')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active) return;
        setSteps(j?.data?.steps ?? []);
        setReadiness(j?.data?.readiness ?? null);
      })
      .catch(() => { /* biarkan kosong */ });
    return () => { active = false; };
  }, []);

  if (!readiness || readiness.total === 0) {
    return (
      <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <h2 className="text-sm font-extrabold text-[#0f172a]">Jenjang Karir Terukur</h2>
        <p className="mt-2 text-xs text-[#64748b]">
          Belum ada tahapan karir yang ditetapkan untuk posisi Anda. Hubungi HRD.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Jenjang Karir Terukur</h2>
      <p className="mt-1 text-xs text-[#475569]">
        Kesiapan <span className="font-extrabold text-[#0f172a]">{readiness.percent}%</span>
        {' · '}{readiness.met} dari {readiness.total} tahapan terpenuhi
      </p>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e2e8f0]"
        role="progressbar"
        aria-valuenow={readiness.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Kesiapan jenjang karir"
      >
        <div className="h-full rounded-full bg-[#007a5a]" style={{ width: `${readiness.percent}%` }} />
      </div>

      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.stepId} className="flex items-start gap-2 rounded-xl border border-[#e2e8f0] p-2.5">
            {s.met
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#007a5a]" aria-hidden="true" />
              : <CircleDashed className="mt-0.5 h-4 w-4 text-[#94a3b8]" aria-hidden="true" />}
            <div>
              <p className="text-xs font-bold text-[#0f172a]">{s.stepName}</p>
              <p className="text-[11px] text-[#64748b]">
                {s.met ? 'Terpenuhi' : 'Belum terpenuhi'} · {s.actual}
                {s.threshold !== null ? ` / ${s.threshold}` : ''} · {s.requirementType}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Mount it in `CareerPathModal`**

In `src/components/employee/CareerPathModal.tsx`, add the import and render it above the existing "Tangga Kemajuan Karir" heading:

```tsx
import CareerLadderPanel from '@/components/employee/CareerLadderPanel';
```

```tsx
<CareerLadderPanel />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/ui/career-ladder.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/components/employee/CareerLadderPanel.tsx src/components/employee/CareerPathModal.tsx tests/ui/career-ladder.test.tsx
git commit -m "feat(ui): jenjang karir terukur di portal karyawan (PRD v2 fase 2)"
```

---

## Phase 2 completion checklist

- [ ] `npx vitest run` green and `npm run build` succeeds.
- [ ] Migrations `0042`–`0046` apply on a fresh PGlite and on PostgreSQL.
- [ ] PRD §8 criteria for Pengajuan Lembur, BPJS & Data Sensitif, Sanksi & Penghargaan, and Career Ladder each map to a passing test above.
- [ ] No endpoint returns a full BPJS number without writing an `audit_logs` row.
