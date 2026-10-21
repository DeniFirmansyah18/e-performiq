# PRD v2.0 Phase 3 — Collaboration & Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Revisi 2 points 5, 6, 7, and 9 real: e-Surat with tiered disposition, supervisor chat, a versioned SOP/PP library with acknowledgment, a personal AI performance coach that never sees restricted data, and the unified activity feed for HRD, managers, and leadership.

**Architecture:** Three additive migrations (`0050`–`0050`) plus one context builder. Letters and chat are separate bounded contexts that only share `users`. Policy acknowledgment is per (document, employee) pair, and only `AKTIF` versions are eligible. The AI coach reuses `generateContent` from `aiService` with a context builder that is written as an allow-list, so a new restricted column cannot leak by accident. The feed reads `activity_events` from Phase 1.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Drizzle ORM (PGlite test / postgres-js production), PostgreSQL 15, Zod, Vitest, Tailwind, lucide-react.

**Spec:** `PRD_Sistem_Penilaian_Karyawan (PT).md` — §5.8, §5.9, §5.10, §5.11, §6.2, §8, §10.3 E–F, §11.5.

## Global Constraints

- Phases 1 and 2 must be complete: `activity_events`, `appendActivity`, `daily_performance_snapshots`, and `disciplinary_actions` exist.
- Services take `db: Db` first; routes use `getAuthSession` → `assertCan` → `ok`/`fail`.
- New permissions go in `src/lib/auth/rbac.ts`; no route may hardcode a role list.
- A letter may not close while any of its dispositions is not `SELESAI` or `DITOLAK`.
- Messages are never hard-deleted by a sender; a recall sets `is_recalled` and keeps the row.
- The AI context builder is an allow-list: salary, payroll, BPJS numbers, medical data, and message bodies are never selected.
- Uploads accept PDF/JPG/PNG only, maximum 5 MB.
- Tests run with `npx vitest run <file>`.

## Review Focus

- **A letter with one disposition still `BELUM_DIBACA`.** Closing must fail with a business error naming the count, and the letter must stay `IN_PROGRESS`.
- **A policy superseded mid-acknowledgment.** The employee's acknowledgment of the old version must not satisfy the new version, and the compliance percentage must drop accordingly.
- **An AI question that asks for the salary.** The answer must refuse and point to HRD, and the context sent to the provider must not contain the salary — assert on the prompt, not only on the reply.
- **A user who is not a member of a conversation.** Reading messages must return 403, not an empty list, so membership is provable.
- **A recall of a message that carried an attachment.** The row must survive with `is_recalled = true`; the attachment reference must not remain fetchable from the API response.

---

### Task 1: e-Surat registry and tiered disposition

**Files:**
- Create: `src/lib/db/migrations/0048_letters_dispositions.sql`
- Create: `src/lib/services/letterService.ts`
- Create: `src/app/api/v1/letters/route.ts`
- Create: `src/app/api/v1/letters/[id]/dispositions/route.ts`
- Create: `src/app/api/v1/letters/dispositions/[id]/route.ts`
- Create: `src/app/api/v1/letters/[id]/close/route.ts`
- Modify: `src/lib/auth/rbac.ts` (add `letter:read`, `letter:manage`, `letter:dispose`)
- Test: `tests/api/letters-routes.test.ts`

**Interfaces:**
- Produces:
  - `registerLetter(db, input: { agendaNumber, direction, classification, subject, sender?, recipient?, letterDate, receivedDate?, fileUrl?, createdBy }): Promise<LetterRow>`
  - `listLetters(db, userId: string): Promise<LetterRow[]>`
  - `addDisposition(db, input: { letterId, fromUserId, toUserId, instruction, priority?, dueDate? }): Promise<DispositionRow>`
  - `updateDisposition(db, input: { id, userId, status: 'DIBACA' | 'DIKERJAKAN' | 'SELESAI' | 'DITOLAK', note? }): Promise<DispositionRow>`
  - `closeLetter(db, input: { letterId, closedBy }): Promise<LetterRow>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as postLetter, GET as getLetters } from '@/app/api/v1/letters/route';
import { POST as postDisposition } from '@/app/api/v1/letters/[id]/dispositions/route';
import { PUT as putDisposition } from '@/app/api/v1/letters/dispositions/[id]/route';
import { POST as postClose } from '@/app/api/v1/letters/[id]/close/route';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('e-Surat & disposisi', () => {
  let client: PGlite;
  let hrCookie = '';
  let mgrCookie = '';
  let empCookie = '';
  let letterId = '';
  let dispositionId = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000002', employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('HR mendaftarkan surat masuk', async () => {
    const res = await postLetter(jsonReq('/api/v1/letters', 'POST', {
      agendaNumber: 'AG-2026-0001', direction: 'INCOMING', classification: 'BIASA',
      subject: 'Undangan rapat koordinasi', sender: 'Kementerian BUMN',
      letterDate: '2026-10-20', fileUrl: 'https://files.example.com/surat.pdf',
    }, hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('OPEN');
    letterId = json.data.id;
  });

  it('karyawan tidak boleh mendaftarkan surat', async () => {
    const res = await postLetter(jsonReq('/api/v1/letters', 'POST', {
      agendaNumber: 'AG-2026-0002', direction: 'INCOMING', classification: 'BIASA',
      subject: 'Tes', letterDate: '2026-10-20',
    }, empCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('manajer meneruskan disposisi', async () => {
    const res = await postDisposition(
      jsonReq(`/api/v1/letters/${letterId}/dispositions`, 'POST', {
        toUserId: 'e0000000-0000-4000-8000-000000000004',
        instruction: 'Siapkan bahan paparan', priority: 'HIGH', dueDate: '2026-10-25',
      }, mgrCookie),
      { params: { id: letterId } } as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('BELUM_DIBACA');
    dispositionId = json.data.id;
  });

  it('surat tidak boleh ditutup selama disposisi belum selesai', async () => {
    const res = await postClose(
      jsonReq(`/api/v1/letters/${letterId}/close`, 'POST', {}, hrCookie),
      { params: { id: letterId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('penerima memperbarui status disposisi sampai SELESAI', async () => {
    for (const status of ['DIBACA', 'DIKERJAKAN', 'SELESAI']) {
      const res = await putDisposition(
        jsonReq(`/api/v1/letters/dispositions/${dispositionId}`, 'PUT', { status, note: 'dikerjakan' }, empCookie),
        { params: { id: dispositionId } } as any,
      );
      expect(res.status).toBe(200);
    }
  });

  it('surat bisa ditutup setelah semua disposisi selesai', async () => {
    const res = await postClose(
      jsonReq(`/api/v1/letters/${letterId}/close`, 'POST', {}, hrCookie),
      { params: { id: letterId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('CLOSED');
  });

  it('daftar surat memuat surat yang terlihat oleh pengguna', async () => {
    const res = await getLetters(getReq('/api/v1/letters', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.some((l: any) => l.id === letterId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/letters-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Write the migration**

```sql
-- 0047: e-Surat, disposisi berjenjang (PRD v2.0 §5.8, §10.3 E).
CREATE TYPE letter_direction_enum AS ENUM ('INCOMING', 'OUTGOING', 'DIRECTIVE');
CREATE TYPE letter_classification_enum AS ENUM ('BIASA', 'TERBATAS', 'RAHASIA');
CREATE TYPE letter_status_enum AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE disposition_status_enum AS ENUM
  ('BELUM_DIBACA', 'DIBACA', 'DIKERJAKAN', 'SELESAI', 'DITOLAK');

CREATE TABLE IF NOT EXISTS letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_number VARCHAR(60) NOT NULL UNIQUE,
  direction letter_direction_enum NOT NULL,
  classification letter_classification_enum NOT NULL DEFAULT 'BIASA',
  subject VARCHAR(255) NOT NULL,
  sender VARCHAR(200),
  recipient VARCHAR(200),
  letter_date DATE NOT NULL,
  received_date DATE,
  file_url TEXT,
  status letter_status_enum NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS letter_dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  instruction TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  due_date DATE,
  status disposition_status_enum NOT NULL DEFAULT 'BELUM_DIBACA',
  read_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_disposition_inbox
  ON letter_dispositions (to_user_id, status, due_date);
```

- [ ] **Step 4: Add permissions**

```ts
| 'letter:read'
| 'letter:manage'
| 'letter:dispose'
```

```ts
'letter:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'letter:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'letter:dispose': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'],
```

- [ ] **Step 5: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';

export type LetterDirection = 'INCOMING' | 'OUTGOING' | 'DIRECTIVE';
export type LetterClassification = 'BIASA' | 'TERBATAS' | 'RAHASIA';
export type LetterStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type DispositionStatus = 'BELUM_DIBACA' | 'DIBACA' | 'DIKERJAKAN' | 'SELESAI' | 'DITOLAK';

export interface LetterRow {
  id: string;
  agendaNumber: string;
  direction: LetterDirection;
  classification: LetterClassification;
  subject: string;
  sender: string | null;
  recipient: string | null;
  letterDate: string;
  receivedDate: string | null;
  fileUrl: string | null;
  status: LetterStatus;
  createdBy: string | null;
}

export interface DispositionRow {
  id: string;
  letterId: string;
  fromUserId: string;
  toUserId: string;
  instruction: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  status: DispositionStatus;
  readAt: string | null;
  completedAt: string | null;
  completionNote: string | null;
}

const LETTER_SELECT = sql`
  id, agenda_number AS "agendaNumber", direction, classification, subject,
  sender, recipient, letter_date AS "letterDate", received_date AS "receivedDate",
  file_url AS "fileUrl", status, created_by AS "createdBy"
`;

const DISP_SELECT = sql`
  id, letter_id AS "letterId", from_user_id AS "fromUserId", to_user_id AS "toUserId",
  instruction, priority, due_date AS "dueDate", status,
  read_at AS "readAt", completed_at AS "completedAt",
  completion_note AS "completionNote"
`;

export async function registerLetter(
  db: Db,
  input: {
    agendaNumber: string;
    direction: LetterDirection;
    classification: LetterClassification;
    subject: string;
    sender?: string;
    recipient?: string;
    letterDate: string;
    receivedDate?: string;
    fileUrl?: string;
    createdBy: string;
  },
): Promise<LetterRow> {
  const res = (await db.execute(sql`
    INSERT INTO letters
      (agenda_number, direction, classification, subject, sender, recipient,
       letter_date, received_date, file_url, status, created_by)
    VALUES (${input.agendaNumber}, ${input.direction}::letter_direction_enum,
            ${input.classification}::letter_classification_enum, ${input.subject},
            ${input.sender ?? null}, ${input.recipient ?? null},
            ${input.letterDate}::date, ${input.receivedDate ?? null}::date,
            ${input.fileUrl ?? null}, 'OPEN', ${input.createdBy}::uuid)
    RETURNING ${LETTER_SELECT}
  `)) as unknown as { rows: LetterRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Surat gagal didaftarkan.');
  return row;
}

export async function listLetters(db: Db, userId: string): Promise<LetterRow[]> {
  const res = (await db.execute(sql`
    SELECT DISTINCT ${LETTER_SELECT}
      FROM letters l
      LEFT JOIN letter_dispositions d ON d.letter_id = l.id
     WHERE l.created_by = ${userId}::uuid
        OR d.to_user_id = ${userId}::uuid
        OR d.from_user_id = ${userId}::uuid
        OR l.classification = 'BIASA'
     ORDER BY l.letter_date DESC
  `)) as unknown as { rows: LetterRow[] };
  return res.rows ?? [];
}

export async function addDisposition(
  db: Db,
  input: {
    letterId: string;
    fromUserId: string;
    toUserId: string;
    instruction: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    dueDate?: string;
  },
): Promise<DispositionRow> {
  if (input.fromUserId === input.toUserId) {
    throw new BusinessRuleError('Disposisi tidak boleh ditujukan kepada diri sendiri.');
  }
  if (input.instruction.trim().length < 5) {
    throw new BusinessRuleError('Instruksi disposisi wajib diisi (minimal 5 karakter).');
  }

  const letter = (await db.execute(sql`
    SELECT status FROM letters WHERE id = ${input.letterId}::uuid
  `)) as unknown as { rows: Array<{ status: LetterStatus }> };
  const status = letter.rows?.[0]?.status;
  if (!status) throw new BusinessRuleError('Surat tidak ditemukan.');
  if (status === 'CLOSED') throw new BusinessRuleError('Surat sudah ditutup.');

  const res = (await db.execute(sql`
    INSERT INTO letter_dispositions
      (letter_id, from_user_id, to_user_id, instruction, priority, due_date)
    VALUES (${input.letterId}::uuid, ${input.fromUserId}::uuid, ${input.toUserId}::uuid,
            ${input.instruction}, ${input.priority ?? 'NORMAL'}, ${input.dueDate ?? null}::date)
    RETURNING ${DISP_SELECT}
  `)) as unknown as { rows: DispositionRow[] };

  await db.execute(sql`
    UPDATE letters SET status = 'IN_PROGRESS'
     WHERE id = ${input.letterId}::uuid AND status = 'OPEN'
  `);

  return res.rows[0];
}

export async function updateDisposition(
  db: Db,
  input: { id: string; userId: string; status: DispositionStatus; note?: string },
): Promise<DispositionRow> {
  const current = (await db.execute(sql`
    SELECT to_user_id AS "toUserId", status FROM letter_dispositions
     WHERE id = ${input.id}::uuid
  `)) as unknown as { rows: Array<{ toUserId: string; status: DispositionStatus }> };

  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Disposisi tidak ditemukan.');
  if (row.toUserId !== input.userId) {
    throw new BusinessRuleError('Hanya penerima disposisi yang dapat memperbarui statusnya.');
  }

  const res = (await db.execute(sql`
    UPDATE letter_dispositions
       SET status = ${input.status}::disposition_status_enum,
           read_at = CASE WHEN ${input.status} <> 'BELUM_DIBACA'
                          THEN COALESCE(read_at, CURRENT_TIMESTAMP) ELSE read_at END,
           completed_at = CASE WHEN ${input.status} IN ('SELESAI', 'DITOLAK')
                               THEN CURRENT_TIMESTAMP ELSE completed_at END,
           completion_note = COALESCE(${input.note ?? null}, completion_note)
     WHERE id = ${input.id}::uuid
    RETURNING ${DISP_SELECT}
  `)) as unknown as { rows: DispositionRow[] };

  return res.rows[0];
}

export async function closeLetter(
  db: Db,
  input: { letterId: string; closedBy: string },
): Promise<LetterRow> {
  const open = (await db.execute(sql`
    SELECT count(*)::int AS n FROM letter_dispositions
     WHERE letter_id = ${input.letterId}::uuid
       AND status IN ('BELUM_DIBACA', 'DIBACA', 'DIKERJAKAN')
  `)) as unknown as { rows: Array<{ n: number }> };

  const pending = Number(open.rows?.[0]?.n ?? 0);
  if (pending > 0) {
    throw new BusinessRuleError(
      `Surat belum dapat ditutup: ${pending} disposisi belum selesai.`,
    );
  }

  const res = (await db.execute(sql`
    UPDATE letters SET status = 'CLOSED'
     WHERE id = ${input.letterId}::uuid AND status <> 'CLOSED'
    RETURNING ${LETTER_SELECT}
  `)) as unknown as { rows: LetterRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Surat tidak ditemukan atau sudah ditutup.');
  return row;
}

/** Dipakai Task 7 (UI) untuk menandai disposisi dibaca sekali saja. */
export async function markDispositionRead(db: Db, id: string, userId: string): Promise<void> {
  await db.execute(sql`
    UPDATE letter_dispositions
       SET status = CASE WHEN status = 'BELUM_DIBACA' THEN 'DIBACA' ELSE status END,
           read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE id = ${id}::uuid AND to_user_id = ${userId}::uuid
  `);
}

/** Notifikasi aktivitas surat; dipanggil setelah transaksi berhasil. */
export async function notifyLetterEvent(db: Db, employeeId: string, summary: string): Promise<void> {
  await appendActivity(db, { employeeId, eventType: 'LETTER', summary, visibility: 'CONFIDENTIAL' });
}
```

- [ ] **Step 6: Write the four routes**

`src/app/api/v1/letters/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listLetters, registerLetter } from '@/lib/services/letterService';

const BodySchema = z.object({
  agendaNumber: z.string().min(3).max(60),
  direction: z.enum(['INCOMING', 'OUTGOING', 'DIRECTIVE']),
  classification: z.enum(['BIASA', 'TERBATAS', 'RAHASIA']),
  subject: z.string().min(3).max(255),
  sender: z.string().max(200).optional(),
  recipient: z.string().max(200).optional(),
  letterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fileUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:read');
    return ok({ items: await listLetters(db, session.userId) });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat surat', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:manage');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await registerLetter(db, { ...parsed.data, createdBy: session.userId });
    return ok(row, 'Surat terdaftar.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mendaftarkan surat', status);
  }
}
```

`src/app/api/v1/letters/[id]/dispositions/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { addDisposition } from '@/lib/services/letterService';

const BodySchema = z.object({
  toUserId: z.string().uuid(),
  instruction: z.string().min(5).max(1000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:dispose');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await addDisposition(db, {
      letterId: params.id,
      fromUserId: session.userId,
      ...parsed.data,
    });
    return ok(row, 'Disposisi dikirim.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengirim disposisi', status);
  }
}
```

`src/app/api/v1/letters/dispositions/[id]/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { updateDisposition } from '@/lib/services/letterService';

const BodySchema = z.object({
  status: z.enum(['DIBACA', 'DIKERJAKAN', 'SELESAI', 'DITOLAK']),
  note: z.string().max(500).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:read');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await updateDisposition(db, {
      id: params.id, userId: session.userId,
      status: parsed.data.status, note: parsed.data.note,
    });
    return ok(row, 'Status disposisi diperbarui.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memperbarui disposisi', status);
  }
}
```

`src/app/api/v1/letters/[id]/close/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { closeLetter } from '@/lib/services/letterService';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:manage');

    const row = await closeLetter(db, { letterId: params.id, closedBy: session.userId });
    return ok(row, 'Surat ditutup.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menutup surat', status);
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/api/letters-routes.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/migrations/0048_letters_dispositions.sql src/lib/services/letterService.ts src/app/api/v1/letters src/lib/auth/rbac.ts tests/api/letters-routes.test.ts
git commit -m "feat(letters): e-Surat + disposisi berjenjang (PRD v2 fase 3)"
```

---

### Task 2: Supervisor chat

**Files:**
- Create: `src/lib/db/migrations/0049_conversations_messages.sql`
- Create: `src/lib/services/chatService.ts`
- Create: `src/app/api/v1/conversations/route.ts`
- Create: `src/app/api/v1/conversations/[id]/messages/route.ts`
- Modify: `src/lib/auth/rbac.ts` (add `chat:read`, `chat:write`)
- Test: `tests/api/chat-routes.test.ts`

**Interfaces:**
- Produces:
  - `createConversation(db, input: { type: 'DIRECT' | 'GROUP'; title?: string; memberIds: string[]; createdBy: string }): Promise<ConversationRow>`
  - `listConversations(db, userId: string): Promise<ConversationRow[]>`
  - `listMessages(db, input: { conversationId: string; userId: string; limit?: number }): Promise<MessageRow[]>`
  - `sendMessage(db, input: { conversationId: string; senderId: string; body: string; attachmentUrl?: string }): Promise<MessageRow>`
  - `recallMessage(db, input: { messageId: string; userId: string }): Promise<MessageRow>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as postConversation } from '@/app/api/v1/conversations/route';
import { GET as getMessages, POST as postMessage } from '@/app/api/v1/conversations/[id]/messages/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';
const MGR_USER = 'e0000000-0000-4000-8000-000000000002';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('chat', () => {
  let client: PGlite;
  let mgrCookie = '';
  let empCookie = '';
  let outsiderCookie = '';
  let conversationId = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: MGR_USER, employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    outsiderCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000005', employeeId: 'b0000000-0000-4000-8000-000000000005', role: 'EMPLOYEE', email: 'lain@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('membuat percakapan langsung', async () => {
    const res = await postConversation(jsonReq('/api/v1/conversations', 'POST', {
      type: 'DIRECT', memberIds: [EMP_USER],
    }, mgrCookie));
    expect(res.status).toBe(200);
    conversationId = (await res.json()).data.id;
  });

  it('anggota dapat mengirim dan membaca pesan', async () => {
    const sent = await postMessage(
      jsonReq(`/api/v1/conversations/${conversationId}/messages`, 'POST', { body: 'Tolong siapkan laporan' }, mgrCookie),
      { params: { id: conversationId } } as any,
    );
    expect(sent.status).toBe(200);

    const read = await getMessages(
      getReq(`/api/v1/conversations/${conversationId}/messages`, empCookie),
      { params: { id: conversationId } } as any,
    );
    expect(read.status).toBe(200);
    const json = await read.json();
    expect(json.data.items[0].body).toBe('Tolong siapkan laporan');
  });

  it('non-anggota ditolak 403, bukan daftar kosong', async () => {
    const res = await getMessages(
      getReq(`/api/v1/conversations/${conversationId}/messages`, outsiderCookie),
      { params: { id: conversationId } } as any,
    );
    expect(res.status).toBe(403);
  });

  it('menolak lampiran dengan ekstensi berbahaya', async () => {
    const res = await postMessage(
      jsonReq(`/api/v1/conversations/${conversationId}/messages`, 'POST', {
        body: 'ini file', attachmentUrl: 'https://files.example.com/payload.exe',
      }, mgrCookie),
      { params: { id: conversationId } } as any,
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/chat-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Write the migration**

```sql
-- 0048: Chat pimpinan (PRD v2.0 §5.8, §10.3 E).
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type VARCHAR(20) NOT NULL DEFAULT 'DIRECT'
    CHECK (conversation_type IN ('DIRECT', 'GROUP')),
  title VARCHAR(200),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  attachment_url TEXT,
  is_recalled BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (NOT (is_recalled AND attachment_url IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, sent_at DESC);
```

- [ ] **Step 4: Add permissions**

```ts
| 'chat:read'
| 'chat:write'
```

```ts
'chat:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'chat:write': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
```

- [ ] **Step 5: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export interface ConversationRow {
  id: string;
  conversationType: 'DIRECT' | 'GROUP';
  title: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  isRecalled: boolean;
  sentAt: string;
}

const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];

/** Validasi sebelum simpan: ekstensi diizinkan. Bukan pemindai antivirus. */
function assertSafeAttachment(url: string): void {
  const path = url.split('?')[0].toLowerCase();
  if (!ALLOWED_EXT.some((ext) => path.endsWith(ext))) {
    throw new BusinessRuleError('Lampiran harus PDF, JPG, atau PNG.');
  }
}

export async function createConversation(
  db: Db,
  input: { type: 'DIRECT' | 'GROUP'; title?: string; memberIds: string[]; createdBy: string },
): Promise<ConversationRow> {
  const members = Array.from(new Set([input.createdBy, ...input.memberIds]));
  if (members.length < 2) {
    throw new BusinessRuleError('Percakapan membutuhkan minimal dua anggota.');
  }
  if (input.type === 'DIRECT' && members.length !== 2) {
    throw new BusinessRuleError('Percakapan langsung hanya untuk dua orang.');
  }

  const conv = (await db.execute(sql`
    INSERT INTO conversations (conversation_type, title, created_by)
    VALUES (${input.type}, ${input.title ?? null}, ${input.createdBy}::uuid)
    RETURNING id, conversation_type AS "conversationType", title,
              NULL::timestamptz AS "lastMessageAt", 0::int AS "unreadCount"
  `)) as unknown as { rows: ConversationRow[] };
  const row = conv.rows[0];

  for (const memberId of members) {
    await db.execute(sql`
      INSERT INTO conversation_members (conversation_id, user_id)
      VALUES (${row.id}::uuid, ${memberId}::uuid)
      ON CONFLICT DO NOTHING
    `);
  }
  return row;
}

export async function listConversations(db: Db, userId: string): Promise<ConversationRow[]> {
  const res = (await db.execute(sql`
    SELECT c.id, c.conversation_type AS "conversationType", c.title,
           (SELECT max(m.sent_at) FROM messages m WHERE m.conversation_id = c.id) AS "lastMessageAt",
           (SELECT count(*)::int FROM messages m
             WHERE m.conversation_id = c.id
               AND m.sender_id <> ${userId}::uuid
               AND (cm.last_read_at IS NULL OR m.sent_at > cm.last_read_at)) AS "unreadCount"
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ${userId}::uuid
     ORDER BY 4 DESC NULLS LAST
  `)) as unknown as { rows: ConversationRow[] };
  return res.rows ?? [];
}

async function assertMember(db: Db, conversationId: string, userId: string): Promise<void> {
  const res = (await db.execute(sql`
    SELECT 1 FROM conversation_members
     WHERE conversation_id = ${conversationId}::uuid AND user_id = ${userId}::uuid
  `)) as unknown as { rows: unknown[] };
  if (!res.rows?.length) {
    throw new BusinessRuleError('Anda bukan anggota percakapan ini.');
  }
}

export async function listMessages(
  db: Db,
  input: { conversationId: string; userId: string; limit?: number },
): Promise<MessageRow[]> {
  await assertMember(db, input.conversationId, input.userId);

  const res = (await db.execute(sql`
    SELECT id, conversation_id AS "conversationId", sender_id AS "senderId",
           CASE WHEN is_recalled THEN 'Pesan ditarik' ELSE body END AS body,
           CASE WHEN is_recalled THEN NULL ELSE attachment_url END AS "attachmentUrl",
           is_recalled AS "isRecalled", sent_at AS "sentAt"
      FROM messages
     WHERE conversation_id = ${input.conversationId}::uuid
     ORDER BY sent_at DESC
     LIMIT ${input.limit ?? 50}
  `)) as unknown as { rows: MessageRow[] };

  await db.execute(sql`
    UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP
     WHERE conversation_id = ${input.conversationId}::uuid AND user_id = ${input.userId}::uuid
  `);

  return res.rows ?? [];
}

export async function sendMessage(
  db: Db,
  input: { conversationId: string; senderId: string; body: string; attachmentUrl?: string },
): Promise<MessageRow> {
  await assertMember(db, input.conversationId, input.senderId);
  if (input.body.trim().length === 0) {
    throw new BusinessRuleError('Pesan tidak boleh kosong.');
  }
  if (input.attachmentUrl) assertSafeAttachment(input.attachmentUrl);

  const res = (await db.execute(sql`
    INSERT INTO messages (conversation_id, sender_id, body, attachment_url)
    VALUES (${input.conversationId}::uuid, ${input.senderId}::uuid,
            ${input.body}, ${input.attachmentUrl ?? null})
    RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId",
              body, attachment_url AS "attachmentUrl", is_recalled AS "isRecalled",
              sent_at AS "sentAt"
  `)) as unknown as { rows: MessageRow[] };
  return res.rows[0];
}

export async function recallMessage(
  db: Db,
  input: { messageId: string; userId: string },
): Promise<MessageRow> {
  const res = (await db.execute(sql`
    UPDATE messages
       SET is_recalled = TRUE, attachment_url = NULL
     WHERE id = ${input.messageId}::uuid AND sender_id = ${input.userId}::uuid
    RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId",
              body, attachment_url AS "attachmentUrl", is_recalled AS "isRecalled",
              sent_at AS "sentAt"
  `)) as unknown as { rows: MessageRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Pesan tidak ditemukan atau bukan milik Anda.');
  return row;
}
```

- [ ] **Step 6: Write the two routes**

`src/app/api/v1/conversations/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { createConversation, listConversations } from '@/lib/services/chatService';

const BodySchema = z.object({
  type: z.enum(['DIRECT', 'GROUP']).default('DIRECT'),
  title: z.string().max(200).optional(),
  memberIds: z.array(z.string().uuid()).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'chat:read');
    return ok({ items: await listConversations(db, session.userId) });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat percakapan', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'chat:write');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await createConversation(db, { ...parsed.data, createdBy: session.userId });
    return ok(row, 'Percakapan dibuat.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal membuat percakapan', status);
  }
}
```

`src/app/api/v1/conversations/[id]/messages/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listMessages, sendMessage } from '@/lib/services/chatService';

const BodySchema = z.object({
  body: z.string().min(1).max(4000),
  attachmentUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'chat:read');

    const items = await listMessages(db, { conversationId: params.id, userId: session.userId });
    return ok({ items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    if (status === 422) return fail('FORBIDDEN', 'Anda bukan anggota percakapan ini.', 403);
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat pesan', status);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'chat:write');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await sendMessage(db, {
      conversationId: params.id, senderId: session.userId, ...parsed.data,
    });
    return ok(row, 'Pesan terkirim.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    if (status === 422) return fail('BUSINESS_RULE_VIOLATION', err?.message ?? 'Pesan ditolak', 400);
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal mengirim pesan', status);
  }
}
```

> `assertMember` throws `BusinessRuleError` (422). The GET route maps it to 403 so membership is provable, which is what the test asserts.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/api/chat-routes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/migrations/0049_conversations_messages.sql src/lib/services/chatService.ts src/app/api/v1/conversations src/lib/auth/rbac.ts tests/api/chat-routes.test.ts
git commit -m "feat(chat): percakapan pimpinan + recall berjejak (PRD v2 fase 3)"
```

---

### Task 3: Policy library and acknowledgment

**Files:**
- Create: `src/lib/db/migrations/0050_policy_documents.sql`
- Create: `src/lib/services/policyService.ts`
- Create: `src/app/api/v1/policies/route.ts`
- Create: `src/app/api/v1/policies/[id]/route.ts`
- Create: `src/app/api/v1/policies/[id]/acknowledge/route.ts`
- Create: `src/app/api/v1/policies/compliance/route.ts`
- Test: `tests/api/policies-routes.test.ts`

**Interfaces:**
- Produces:
  - `listPolicies(db, employeeId: string): Promise<PolicyRow[]>` — only `AKTIF`, each with `acknowledgedAt`
  - `getPolicy(db, id: string): Promise<PolicyDetail | null>`
  - `acknowledge(db, input: { policyId, employeeId }): Promise<{ acknowledgedAt: string }>`
  - `publishVersion(db, input: { documentCode, title, policyType, version, effectiveDate, fileUrl, ownerDepartmentId?, supersedesId? }): Promise<PolicyRow>`
  - `compliance(db): Promise<Array<{ departmentId: string; active: number; acknowledged: number; percent: number }>>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { publishVersion } from '@/lib/services/policyService';
import { GET as getPolicies } from '@/app/api/v1/policies/route';
import { POST as postAck } from '@/app/api/v1/policies/[id]/acknowledge/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });
const postReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST', headers: new Headers({ cookie }), body: JSON.stringify({}),
  });

describe('policy library', () => {
  let client: PGlite;
  let db: any;
  let empCookie = '';
  let v1Id = '';
  let v2Id = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;

    const v1 = await publishVersion(db, {
      documentCode: 'SOP-HR-001', title: 'SOP Cuti', policyType: 'SOP',
      version: '1.0', effectiveDate: '2026-01-01', fileUrl: 'https://files.example.com/sop-v1.pdf',
    });
    v1Id = v1.id;

    const v2 = await publishVersion(db, {
      documentCode: 'SOP-HR-001', title: 'SOP Cuti', policyType: 'SOP',
      version: '2.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/sop-v2.pdf',
      supersedesId: v1Id,
    });
    v2Id = v2.id;
  });
  afterAll(async () => { await client.close(); });

  it('hanya versi AKTIF yang tampil, versi lama OBSOLETE', async () => {
    const res = await getPolicies(getReq('/api/v1/policies', empCookie));
    const json = await res.json();
    const ids = json.data.items.map((p: any) => p.id);
    expect(ids).toContain(v2Id);
    expect(ids).not.toContain(v1Id);
  });

  it('acknowledgment versi lama tidak memenuhi versi baru', async () => {
    await db.execute(`
      INSERT INTO policy_acknowledgments (policy_document_id, employee_id)
      VALUES ('${v1Id}', '${BUDI}')`);

    const res = await getPolicies(getReq('/api/v1/policies', empCookie));
    const row = (await res.json()).data.items.find((p: any) => p.id === v2Id);
    expect(row.acknowledgedAt).toBeNull();
  });

  it('menandai paham versi aktif', async () => {
    const res = await postAck(postReq(`/api/v1/policies/${v2Id}/acknowledge`, empCookie), { params: { id: v2Id } } as any);
    expect(res.status).toBe(200);

    const list = await getPolicies(getReq('/api/v1/policies', empCookie));
    const row = (await list.json()).data.items.find((p: any) => p.id === v2Id);
    expect(row.acknowledgedAt).toBeTruthy();
  });

  it('menolak acknowledgment pada dokumen non-aktif', async () => {
    const res = await postAck(postReq(`/api/v1/policies/${v1Id}/acknowledge`, empCookie), { params: { id: v1Id } } as any);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/policies-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Write the migration**

```sql
-- 0049: Perpustakaan SOP/PP + acknowledgment (PRD v2.0 §5.9, §10.3 F).
CREATE TYPE policy_type_enum AS ENUM ('SOP', 'PP', 'SK', 'IK');
CREATE TYPE policy_status_enum AS ENUM ('DRAFT', 'AKTIF', 'OBSOLETE');

CREATE TABLE IF NOT EXISTS policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code VARCHAR(60) NOT NULL,
  title VARCHAR(255) NOT NULL,
  policy_type policy_type_enum NOT NULL,
  version VARCHAR(20) NOT NULL,
  owner_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  effective_date DATE NOT NULL,
  file_url TEXT NOT NULL,
  status policy_status_enum NOT NULL DEFAULT 'DRAFT',
  supersedes_id UUID REFERENCES policy_documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_code, version)
);

CREATE INDEX IF NOT EXISTS idx_policy_active
  ON policy_documents (policy_type, status, effective_date DESC);

CREATE TABLE IF NOT EXISTS policy_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (policy_document_id, employee_id)
);
```

- [ ] **Step 4: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export type PolicyType = 'SOP' | 'PP' | 'SK' | 'IK';
export type PolicyStatus = 'DRAFT' | 'AKTIF' | 'OBSOLETE';

export interface PolicyRow {
  id: string;
  documentCode: string;
  title: string;
  policyType: PolicyType;
  version: string;
  effectiveDate: string;
  fileUrl: string;
  status: PolicyStatus;
  acknowledgedAt: string | null;
}

export async function listPolicies(db: Db, employeeId: string): Promise<PolicyRow[]> {
  const res = (await db.execute(sql`
    SELECT p.id, p.document_code AS "documentCode", p.title,
           p.policy_type AS "policyType", p.version,
           p.effective_date AS "effectiveDate", p.file_url AS "fileUrl", p.status,
           a.acknowledged_at AS "acknowledgedAt"
      FROM policy_documents p
      LEFT JOIN policy_acknowledgments a
        ON a.policy_document_id = p.id AND a.employee_id = ${employeeId}::uuid
     WHERE p.status = 'AKTIF'
     ORDER BY p.policy_type, p.title
  `)) as unknown as { rows: PolicyRow[] };
  return res.rows ?? [];
}

export async function getPolicy(db: Db, id: string): Promise<PolicyRow | null> {
  const res = (await db.execute(sql`
    SELECT id, document_code AS "documentCode", title, policy_type AS "policyType",
           version, effective_date AS "effectiveDate", file_url AS "fileUrl", status,
           NULL::timestamptz AS "acknowledgedAt"
      FROM policy_documents WHERE id = ${id}::uuid
  `)) as unknown as { rows: PolicyRow[] };
  return res.rows?.[0] ?? null;
}

export async function acknowledge(
  db: Db,
  input: { policyId: string; employeeId: string },
): Promise<{ acknowledgedAt: string }> {
  const doc = await getPolicy(db, input.policyId);
  if (!doc) throw new BusinessRuleError('Dokumen tidak ditemukan.');
  if (doc.status !== 'AKTIF') {
    throw new BusinessRuleError('Hanya dokumen berstatus AKTIF yang dapat diakui.');
  }

  const res = (await db.execute(sql`
    INSERT INTO policy_acknowledgments (policy_document_id, employee_id)
    VALUES (${input.policyId}::uuid, ${input.employeeId}::uuid)
    ON CONFLICT (policy_document_id, employee_id) DO NOTHING
    RETURNING acknowledged_at AS "acknowledgedAt"
  `)) as unknown as { rows: Array<{ acknowledgedAt: string }> };

  if (res.rows?.[0]) return res.rows[0];

  const existing = (await db.execute(sql`
    SELECT acknowledged_at AS "acknowledgedAt" FROM policy_acknowledgments
     WHERE policy_document_id = ${input.policyId}::uuid
       AND employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: Array<{ acknowledgedAt: string }> };
  return existing.rows[0];
}

/** Menerbitkan versi baru; versi lama otomatis menjadi OBSOLETE. */
export async function publishVersion(
  db: Db,
  input: {
    documentCode: string;
    title: string;
    policyType: PolicyType;
    version: string;
    effectiveDate: string;
    fileUrl: string;
    ownerDepartmentId?: string;
    supersedesId?: string;
  },
): Promise<PolicyRow> {
  if (input.supersedesId) {
    await db.execute(sql`
      UPDATE policy_documents SET status = 'OBSOLETE' WHERE id = ${input.supersedesId}::uuid
    `);
  }

  const res = (await db.execute(sql`
    INSERT INTO policy_documents
      (document_code, title, policy_type, version, owner_department_id,
       effective_date, file_url, status, supersedes_id)
    VALUES (${input.documentCode}, ${input.title}, ${input.policyType}::policy_type_enum,
            ${input.version}, ${input.ownerDepartmentId ?? null}::uuid,
            ${input.effectiveDate}::date, ${input.fileUrl}, 'AKTIF',
            ${input.supersedesId ?? null}::uuid)
    RETURNING id, document_code AS "documentCode", title,
              policy_type AS "policyType", version,
              effective_date AS "effectiveDate", file_url AS "fileUrl", status,
              NULL::timestamptz AS "acknowledgedAt"
  `)) as unknown as { rows: PolicyRow[] };
  return res.rows[0];
}

export async function compliance(
  db: Db,
): Promise<Array<{ departmentId: string; active: number; acknowledged: number; percent: number }>> {
  const res = (await db.execute(sql`
    SELECT e.department_id AS "departmentId",
           count(DISTINCT e.id)::int AS active,
           count(DISTINCT a.employee_id)::int AS acknowledged
      FROM employees e
      LEFT JOIN policy_acknowledgments a ON a.employee_id = e.id
      LEFT JOIN policy_documents p
        ON p.id = a.policy_document_id AND p.status = 'AKTIF'
     WHERE e.status <> 'RESIGNED'
     GROUP BY e.department_id
  `)) as unknown as { rows: Array<{ departmentId: string; active: number; acknowledged: number }> };

  return (res.rows ?? []).map((r) => ({
    departmentId: r.departmentId,
    active: Number(r.active),
    acknowledged: Number(r.acknowledged),
    percent: Number(r.active) > 0 ? Math.round((Number(r.acknowledged) / Number(r.active)) * 100) : 0,
  }));
}
```

- [ ] **Step 5: Write the four routes**

`src/app/api/v1/policies/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listPolicies } from '@/lib/services/policyService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    return ok({ items: await listPolicies(db, session.employeeId) });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat dokumen', 500);
  }
}
```

`src/app/api/v1/policies/[id]/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getPolicy } from '@/lib/services/policyService';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');

    const doc = await getPolicy(db, params.id);
    if (!doc) return fail('NOT_FOUND', 'Dokumen tidak ditemukan.', 404);
    return ok(doc);
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat dokumen', 500);
  }
}
```

`src/app/api/v1/policies/[id]/acknowledge/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { acknowledge } from '@/lib/services/policyService';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const row = await acknowledge(db, { policyId: params.id, employeeId: session.employeeId });
    return ok(row, 'Dokumen ditandai telah dipahami.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menandai dokumen', status);
  }
}
```

`src/app/api/v1/policies/compliance/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { compliance } from '@/lib/services/policyService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'audit:read');

    return ok({ items: await compliance(db) });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat kepatuhan', 500);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/api/policies-routes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/migrations/0050_policy_documents.sql src/lib/services/policyService.ts src/app/api/v1/policies tests/api/policies-routes.test.ts
git commit -m "feat(policy): perpustakaan SOP/PP + acknowledgment berversi (PRD v2 fase 3)"
```

---

### Task 4: AI performance coach with an allow-listed context

**Files:**
- Create: `src/lib/services/aiCoachService.ts`
- Create: `src/app/api/v1/ai/performance-coach/route.ts`
- Test: `tests/integration/aiCoach.test.ts`

**Interfaces:**
- Produces:
  - `buildCoachContext(db, employeeId: string): Promise<CoachContext>` — allow-list only
  - `answerPerformanceQuestion(db, input: { employeeId, question, role }): Promise<{ reply: string; configured: boolean; sources: string[] }>`
  - `buildCoachPrompt(context: CoachContext, question: string): string` — exported for the leak test

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { buildCoachContext, buildCoachPrompt } from '@/lib/services/aiCoachService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('AI performance coach', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    await db.execute(`
      INSERT INTO employee_social_security (employee_id, bpjs_tk_number)
      VALUES ('${BUDI}', '8101234567890123')
      ON CONFLICT DO NOTHING`);
    await db.execute(`
      INSERT INTO daily_performance_snapshots
        (employee_id, snapshot_date, dpi_score, traffic_light, indicators_expected, indicators_filled)
      VALUES ('${BUDI}', '2026-10-20', 64.5, 'RED', 3, 2)
      ON CONFLICT DO NOTHING`);
  });
  afterAll(async () => { await client.close(); });

  it('konteks memuat performa nyata', async () => {
    const ctx = await buildCoachContext(db, BUDI);
    expect(ctx.recentSnapshots.length).toBeGreaterThanOrEqual(1);
    expect(ctx.recentSnapshots[0].trafficLight).toBe('RED');
  });

  it('konteks tidak memuat gaji, BPJS, atau data medis', async () => {
    const ctx = await buildCoachContext(db, BUDI);
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain('8101234567890123');
    expect(serialized.toLowerCase()).not.toContain('salary');
    expect(serialized.toLowerCase()).not.toContain('base_salary');
    expect(serialized.toLowerCase()).not.toContain('bpjs');
  });

  it('prompt menyatakan batas data dan memuat sumber', () => {
    const prompt = buildCoachPrompt(
      {
        employeeName: 'Budi', employmentStatus: 'TETAP',
        recentSnapshots: [{ date: '2026-10-20', score: 64.5, trafficLight: 'RED' }],
        weakestIndicators: [{ name: 'Tiket selesai', actual: 4, target: 10 }],
        attendance: { present: 18, absent: 2 },
        leaveBalanceDays: 8,
        trainingsCompleted: 3,
        activeSanctions: 0,
        careerReadinessPercent: 50,
      },
      'Kenapa status saya merah?',
    );
    expect(prompt).toContain('tidak memuat gaji');
    expect(prompt).toContain('2026-10-20');
    expect(prompt).toContain('Tiket selesai');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/aiCoach.test.ts`
Expected: FAIL — cannot resolve `aiCoachService`.

- [ ] **Step 3: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { generateContent } from './aiService';
import { readiness } from './careerLadderService';

export interface CoachContext {
  employeeName: string;
  employmentStatus: string;
  recentSnapshots: Array<{ date: string; score: number | null; trafficLight: string }>;
  weakestIndicators: Array<{ name: string; actual: number; target: number }>;
  attendance: { present: number; absent: number };
  leaveBalanceDays: number;
  trainingsCompleted: number;
  activeSanctions: number;
  careerReadinessPercent: number;
}

/**
 * Allow-list: hanya kolom di bawah ini yang boleh masuk prompt.
 * Gaji, payroll, nomor BPJS, data medis, dan isi pesan TIDAK PERNAH dipilih.
 */
export async function buildCoachContext(db: Db, employeeId: string): Promise<CoachContext> {
  const emp = (await db.execute(sql`
    SELECT full_name AS "employeeName", employment_status AS "employmentStatus"
      FROM employees WHERE id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ employeeName: string; employmentStatus: string }> };

  const snaps = (await db.execute(sql`
    SELECT snapshot_date AS date, dpi_score::float8 AS score, traffic_light AS "trafficLight"
      FROM daily_performance_snapshots
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY snapshot_date DESC LIMIT 30
  `)) as unknown as { rows: CoachContext['recentSnapshots'] };

  const weak = (await db.execute(sql`
    SELECT i.indicator_name AS name, e.actual_value::float8 AS actual,
           i.target_value::float8 AS target
      FROM kpi_daily_entries e
      JOIN kpi_indicators i ON i.id = e.indicator_id
     WHERE e.employee_id = ${employeeId}::uuid
       AND e.entry_date >= CURRENT_DATE - INTERVAL '30 days'
       AND e.actual_value < i.target_value
     ORDER BY (e.actual_value / NULLIF(i.target_value, 0)) ASC
     LIMIT 5
  `)) as unknown as { rows: CoachContext['weakestIndicators'] };

  const att = (await db.execute(sql`
    SELECT count(*) FILTER (WHERE check_in_at IS NOT NULL)::int AS present,
           count(*) FILTER (WHERE check_in_at IS NULL)::int AS absent
      FROM attendance_logs
     WHERE employee_id = ${employeeId}::uuid
       AND work_date >= CURRENT_DATE - INTERVAL '30 days'
  `)) as unknown as { rows: Array<{ present: number; absent: number }> };

  const leave = (await db.execute(sql`
    SELECT COALESCE(sum(total_days), 0)::int AS used
      FROM leave_requests
     WHERE employee_id = ${employeeId}::uuid
       AND status = 'APPROVED'
       AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  `)) as unknown as { rows: Array<{ used: number }> };

  const training = (await db.execute(sql`
    SELECT count(*)::int AS n FROM course_completions WHERE employee_id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ n: number }> };

  const sanctions = (await db.execute(sql`
    SELECT count(*)::int AS n FROM disciplinary_actions
     WHERE employee_id = ${employeeId}::uuid
       AND appeal_status <> 'APPEAL_ACCEPTED'
       AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
  `)) as unknown as { rows: Array<{ n: number }> };

  const career = await readiness(db, employeeId);

  return {
    employeeName: emp.rows?.[0]?.employeeName ?? 'Karyawan',
    employmentStatus: emp.rows?.[0]?.employmentStatus ?? 'UNKNOWN',
    recentSnapshots: snaps.rows ?? [],
    weakestIndicators: weak.rows ?? [],
    attendance: {
      present: Number(att.rows?.[0]?.present ?? 0),
      absent: Number(att.rows?.[0]?.absent ?? 0),
    },
    leaveBalanceDays: Math.max(0, 12 - Number(leave.rows?.[0]?.used ?? 0)),
    trainingsCompleted: Number(training.rows?.[0]?.n ?? 0),
    activeSanctions: Number(sanctions.rows?.[0]?.n ?? 0),
    careerReadinessPercent: career.percent,
  };
}

export function buildCoachPrompt(context: CoachContext, question: string): string {
  return (
    'Anda adalah pelatih performa karyawan. Jawab dalam Bahasa Indonesia, maksimal 6 kalimat, ' +
    'berdasarkan HANYA data berikut. Konteks ini tidak memuat gaji, BPJS, data medis, atau pesan pribadi; ' +
    'bila pengguna menanyakannya, arahkan ke kanal resmi HRD.\n\n' +
    `Data performa (JSON):\n${JSON.stringify(context)}\n\n` +
    `Pertanyaan: ${question}\n\n` +
    'Sebutkan sumber data yang Anda pakai (tanggal snapshot atau nama indikator). ' +
    'Bila data tidak tersedia, katakan tidak tahu; jangan mengarang angka.'
  );
}

export async function answerPerformanceQuestion(
  db: Db,
  input: { employeeId: string; question: string; role: string },
): Promise<{ reply: string; configured: boolean; sources: string[] }> {
  const context = await buildCoachContext(db, input.employeeId);
  const res = await generateContent(buildCoachPrompt(context, input.question), {
    maxOutputTokens: 1024,
    temperature: 0.25,
  });

  const sources: string[] = [];
  for (const s of context.recentSnapshots.slice(0, 3)) sources.push(`snapshot ${s.date}`);
  for (const w of context.weakestIndicators.slice(0, 3)) sources.push(`indikator ${w.name}`);

  return { reply: res.text, configured: res.configured, sources };
}
```

- [ ] **Step 4: Write the route**

`src/app/api/v1/ai/performance-coach/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { answerPerformanceQuestion } from '@/lib/services/aiCoachService';

const BodySchema = z.object({ question: z.string().min(5).max(1000) });

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'ai:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Pertanyaan tidak valid', 400);
    }

    const result = await answerPerformanceQuestion(db, {
      employeeId: session.employeeId,
      question: parsed.data.question,
      role: session.role,
    });
    return ok(result);
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal menjawab pertanyaan', 500);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/aiCoach.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/aiCoachService.ts src/app/api/v1/ai/performance-coach tests/integration/aiCoach.test.ts
git commit -m "feat(ai): performance coach dengan konteks allow-list (PRD v2 fase 3)"
```

---

### Task 5: Activity feed API

**Files:**
- Create: `src/app/api/v1/activity-feed/route.ts`
- Create: `src/app/api/v1/activity-feed/team/route.ts`
- Create: `src/app/api/v1/activity-feed/[employeeId]/route.ts`
- Test: `tests/api/activity-feed-routes.test.ts`

**Interfaces:**
- Consumes: `listActivity` (Phase 1), `appendActivity`.
- Produces: three read endpoints that never return `RESTRICTED` rows.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { appendActivity } from '@/lib/services/activityFeedService';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getMine } from '@/app/api/v1/activity-feed/route';
import { GET as getEmployee } from '@/app/api/v1/activity-feed/[employeeId]/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('activity feed routes', () => {
  let client: PGlite;
  let db: any;
  let empCookie = '';
  let hrCookie = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    await appendActivity(db, { employeeId: BUDI, eventType: 'KPI_DAILY', summary: 'Mengirim 2 indikator' });
    await appendActivity(db, {
      employeeId: BUDI, eventType: 'DISCIPLINARY', summary: 'SP1 diterbitkan', visibility: 'CONFIDENTIAL',
    });

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('feed sendiri memuat kejadian INTERNAL dan CONFIDENTIAL milik sendiri', async () => {
    const res = await getMine(getReq('/api/v1/activity-feed', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('tidak pernah memuat kejadian RESTRICTED', async () => {
    await db.execute(`
      INSERT INTO activity_events (employee_id, event_type, summary, visibility)
      VALUES ('${BUDI}', 'KPI_DAILY', 'gaji naik', 'RESTRICTED')`);
    const res = await getMine(getReq('/api/v1/activity-feed', empCookie));
    const json = await res.json();
    expect(json.data.items.some((e: any) => e.visibility === 'RESTRICTED')).toBe(false);
  });

  it('HR dapat membaca feed karyawan tertentu', async () => {
    const res = await getEmployee(
      getReq(`/api/v1/activity-feed/${BUDI}`, hrCookie),
      { params: { employeeId: BUDI } } as any,
    );
    expect(res.status).toBe(200);
  });

  it('karyawan tidak boleh membaca feed karyawan lain', async () => {
    const res = await getEmployee(
      getReq(`/api/v1/activity-feed/${BUDI}`, empCookie),
      { params: { employeeId: 'b0000000-0000-4000-8000-000000000002' } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/activity-feed-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Write the three routes**

`src/app/api/v1/activity-feed/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listActivity } from '@/lib/services/activityFeedService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const items = (await listActivity(db, session.employeeId, 100))
      .filter((e) => e.visibility !== 'RESTRICTED');
    return ok({ items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat feed', 500);
  }
}
```

`src/app/api/v1/activity-feed/team/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:approve');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const res = (await db.execute(sql`
      WITH RECURSIVE reports AS (
        SELECT id FROM employees WHERE manager_id = ${session.employeeId}::uuid
        UNION
        SELECT e.id FROM employees e JOIN reports r ON e.manager_id = r.id
      )
      SELECT a.id, a.employee_id AS "employeeId", e.full_name AS "employeeName",
             a.event_type AS "eventType", a.summary, a.visibility,
             a.occurred_at AS "occurredAt"
        FROM activity_events a
        JOIN employees e ON e.id = a.employee_id
        JOIN reports r ON r.id = a.employee_id
       WHERE a.visibility <> 'RESTRICTED'
       ORDER BY a.occurred_at DESC
       LIMIT 200
    `)) as unknown as { rows: unknown[] };

    return ok({ items: res.rows ?? [] });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat feed tim', 500);
  }
}
```

`src/app/api/v1/activity-feed/[employeeId]/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan, can } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listActivity } from '@/lib/services/activityFeedService';

export async function GET(req: NextRequest, { params }: { params: { employeeId: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');

    const isSelf = session.employeeId === params.employeeId;
    const canReadOthers = can(session.role, 'audit:read') || can(session.role, 'attendance:approve');
    if (!isSelf && !canReadOthers) {
      return fail('FORBIDDEN', 'Anda hanya dapat membaca feed aktivitas Anda sendiri.', 403);
    }

    const items = (await listActivity(db, params.employeeId, 200))
      .filter((e) => e.visibility !== 'RESTRICTED' || can(session.role, 'audit:read'));
    return ok({ items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat feed', 500);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/api/activity-feed-routes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/activity-feed tests/api/activity-feed-routes.test.ts
git commit -m "feat(feed): endpoint feed sendiri, tim, dan per karyawan (PRD v2 fase 3)"
```

---

### Task 6: e-Surat inbox UI

**Files:**
- Create: `src/components/employee/LetterInboxModal.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx` (add an `ActionCard` + mount)
- Test: `tests/ui/letter-inbox.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/letters`, `PUT /api/v1/letters/dispositions/:id`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LetterInboxModal from '@/components/employee/LetterInboxModal';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { items: [
      { id: 'l1', agendaNumber: 'AG-2026-0001', direction: 'INCOMING', classification: 'BIASA',
        subject: 'Undangan rapat koordinasi', sender: 'Kementerian BUMN',
        letterDate: '2026-10-20', status: 'IN_PROGRESS' },
    ] } }),
  })) as any));
});

describe('LetterInboxModal', () => {
  it('menampilkan surat dengan nomor agenda dan status', async () => {
    render(<LetterInboxModal open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/AG-2026-0001/)).toBeTruthy());
    expect(screen.getByText(/Undangan rapat koordinasi/)).toBeTruthy();
    expect(screen.getByText(/Sedang diproses/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/letter-inbox.test.tsx`
Expected: FAIL — cannot resolve `LetterInboxModal`.

- [ ] **Step 3: Write the component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Mail, Paperclip } from 'lucide-react';

interface Letter {
  id: string;
  agendaNumber: string;
  direction: 'INCOMING' | 'OUTGOING' | 'DIRECTIVE';
  classification: 'BIASA' | 'TERBATAS' | 'RAHASIA';
  subject: string;
  sender: string | null;
  letterDate: string;
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
}

const STATUS_LABEL: Record<Letter['status'], string> = {
  DRAFT: 'Draf', OPEN: 'Baru', IN_PROGRESS: 'Sedang diproses', CLOSED: 'Selesai',
};

const DIRECTION_LABEL: Record<Letter['direction'], string> = {
  INCOMING: 'Surat masuk', OUTGOING: 'Surat keluar', DIRECTIVE: 'Surat perintah',
};

export default function LetterInboxModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [letters, setLetters] = useState<Letter[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch('/api/v1/letters')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setLetters(j?.data?.items ?? []); })
      .catch(() => { /* biarkan kosong */ });
    return () => { active = false; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="letter-title">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="letter-title" className="flex items-center gap-1.5 text-base font-extrabold text-[#0f172a]">
            <Mail className="h-4 w-4" aria-hidden="true" /> e-Surat & Disposisi
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-[#e2e8f0]">
          {letters.map((l) => (
            <li key={l.id} className="py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                {l.agendaNumber} · {DIRECTION_LABEL[l.direction]} · {l.classification}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#0f172a]">{l.subject}</p>
              <p className="mt-0.5 text-xs text-[#475569]">
                {l.sender ?? '—'} · {l.letterDate} · {STATUS_LABEL[l.status]}
              </p>
            </li>
          ))}
          {letters.length === 0 && (
            <li className="py-3 text-xs text-[#64748b]">Belum ada surat untuk Anda.</li>
          )}
        </ul>

        <p className="mt-3 flex items-center gap-1 text-[11px] text-[#64748b]">
          <Paperclip className="h-3 w-3" aria-hidden="true" />
          Disposisi dan tanda terima baca dikelola oleh pimpinan melalui menu yang sama.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount it in the portal**

Add the import and state:

```tsx
import LetterInboxModal from '@/components/employee/LetterInboxModal';
```

```tsx
const [isLetterOpen, setIsLetterOpen] = useState(false);
```

Add an `ActionCard` and the modal:

```tsx
<ActionCard
  icon={FileText}
  tone="indigo"
  title="e-Surat & Disposisi"
  tag="Tanda terima"
  description="Surat masuk, surat perintah, dan disposisi pimpinan beserta status tindak lanjutnya."
  onClick={() => setIsLetterOpen(true)}
/>
```

```tsx
<LetterInboxModal open={isLetterOpen} onClose={() => setIsLetterOpen(false)} />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/ui/letter-inbox.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/employee/LetterInboxModal.tsx src/app/dashboard/employee-portal/page.tsx tests/ui/letter-inbox.test.tsx
git commit -m "feat(ui): kotak masuk e-Surat (PRD v2 fase 3)"
```

---

### Task 7: Policy library UI

**Files:**
- Create: `src/components/employee/PolicyLibraryModal.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx` (add an `ActionCard` + mount)
- Test: `tests/ui/policy-library.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/policies`, `POST /api/v1/policies/:id/acknowledge`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PolicyLibraryModal from '@/components/employee/PolicyLibraryModal';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { items: [
      { id: 'p1', documentCode: 'SOP-HR-001', title: 'SOP Cuti', policyType: 'SOP',
        version: '2.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/sop.pdf',
        status: 'AKTIF', acknowledgedAt: null },
    ] } }),
  })) as any));
});

describe('PolicyLibraryModal', () => {
  it('menampilkan dokumen aktif dan status belum diakui', async () => {
    render(<PolicyLibraryModal open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('SOP Cuti')).toBeTruthy());
    expect(screen.getByText(/Belum diakui/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/policy-library.test.tsx`
Expected: FAIL — cannot resolve `PolicyLibraryModal`.

- [ ] **Step 3: Write the component**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, BookOpen, ExternalLink } from 'lucide-react';

interface Policy {
  id: string;
  documentCode: string;
  title: string;
  policyType: 'SOP' | 'PP' | 'SK' | 'IK';
  version: string;
  effectiveDate: string;
  fileUrl: string;
  acknowledgedAt: string | null;
}

export default function PolicyLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/policies');
    if (!res.ok) return;
    const json = await res.json();
    setPolicies(json?.data?.items ?? []);
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const acknowledge = async (id: string) => {
    const res = await fetch(`/api/v1/policies/${id}/acknowledge`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal menandai dokumen.'); return; }
    setMessage('Dokumen ditandai telah dipahami.');
    await load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="policy-title">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="policy-title" className="flex items-center gap-1.5 text-base font-extrabold text-[#0f172a]">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> SOP & Peraturan Perusahaan
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-[#e2e8f0]">
          {policies.map((p) => (
            <li key={p.id} className="py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                {p.policyType} · {p.documentCode} · v{p.version}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#0f172a]">{p.title}</p>
              <p className="mt-0.5 text-[11px] text-[#64748b]">Efektif {p.effectiveDate}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={p.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] px-2.5 py-1 text-[11px] font-semibold text-[#475569] hover:bg-[#f8fafc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" /> Buka dokumen
                </a>

                {p.acknowledgedAt ? (
                  <span className="text-[11px] font-semibold text-[#007a5a]">Sudah diakui</span>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-[#b45309]">Belum diakui</span>
                    <button
                      type="button"
                      onClick={() => acknowledge(p.id)}
                      className="rounded-lg bg-[#007a5a] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
                    >
                      Tandai telah dipahami
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
          {policies.length === 0 && (
            <li className="py-3 text-xs text-[#64748b]">Belum ada dokumen aktif.</li>
          )}
        </ul>

        {message && <p className="mt-3 text-xs font-semibold text-[#0f172a]">{message}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount it in the portal**

```tsx
import PolicyLibraryModal from '@/components/employee/PolicyLibraryModal';
```

```tsx
const [isPolicyOpen, setIsPolicyOpen] = useState(false);
```

```tsx
<ActionCard
  icon={BookOpen}
  tone="slate"
  title="SOP & Peraturan"
  tag="Wajib dibaca"
  description="Perpustakaan SOP, PP, dan SK aktif beserta kewajiban menandai telah dipahami."
  onClick={() => setIsPolicyOpen(true)}
/>
```

```tsx
<PolicyLibraryModal open={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/ui/policy-library.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/employee/PolicyLibraryModal.tsx src/app/dashboard/employee-portal/page.tsx tests/ui/policy-library.test.tsx
git commit -m "feat(ui): perpustakaan SOP/PP + akui-paham (PRD v2 fase 3)"
```

---

### Task 8: AI coach and activity feed UI

**Files:**
- Create: `src/components/employee/PerformanceCoachPanel.tsx`
- Create: `src/components/employee/ActivityFeedPanel.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx` (mount both under the Daily Cockpit)
- Test: `tests/ui/coach-and-feed.test.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/ai/performance-coach`, `GET /api/v1/activity-feed`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ActivityFeedPanel from '@/components/employee/ActivityFeedPanel';
import PerformanceCoachPanel from '@/components/employee/PerformanceCoachPanel';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { items: [
      { id: 'a1', eventType: 'KPI_DAILY', summary: 'Mengirim 2 indikator', visibility: 'INTERNAL',
        occurredAt: '2026-10-21T08:00:00Z' },
    ] } }),
  })) as any));
});

describe('feed & coach UI', () => {
  it('feed menampilkan ringkasan kejadian', async () => {
    render(<ActivityFeedPanel />);
    await waitFor(() => expect(screen.getByText(/Mengirim 2 indikator/)).toBeTruthy());
  });

  it('coach menyediakan input pertanyaan', () => {
    render(<PerformanceCoachPanel />);
    expect(screen.getByLabelText(/Pertanyaan tentang performa/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/coach-and-feed.test.tsx`
Expected: FAIL — cannot resolve the components.

- [ ] **Step 3: Write `ActivityFeedPanel`**

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Event {
  id: string;
  eventType: string;
  summary: string;
  occurredAt: string;
}

const LABEL: Record<string, string> = {
  ATTENDANCE: 'Kehadiran', KPI_DAILY: 'KPI harian', DPI_STATUS: 'Status harian',
  LEAVE: 'Cuti', OVERTIME: 'Lembur', TRAINING: 'Pelatihan', LETTER: 'Surat',
  DISCIPLINARY: 'Sanksi', RECOGNITION: 'Penghargaan', CAREER: 'Karir',
};

export default function ActivityFeedPanel() {
  const [items, setItems] = useState<Event[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/activity-feed')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setItems(j?.data?.items ?? []); })
      .catch(() => { /* biarkan kosong */ });
    return () => { active = false; };
  }, []);

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Aktivitas Terbaru</h2>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 10).map((e) => (
          <li key={e.id} className="text-xs">
            <span className="font-semibold text-[#0f172a]">{LABEL[e.eventType] ?? e.eventType}</span>
            {' · '}
            <span className="text-[#475569]">{e.summary}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-[#64748b]">Belum ada aktivitas.</li>}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Write `PerformanceCoachPanel`**

```tsx
'use client';

import { useState } from 'react';
import { Bot, Send } from 'lucide-react';

export default function PerformanceCoachPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (question.trim().length < 5) { setError('Pertanyaan minimal 5 karakter.'); return; }
    setBusy(true);
    setError(null);
    setAnswer(null);
    const res = await fetch('/api/v1/ai/performance-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json?.detail ?? 'Gagal memproses pertanyaan.'); return; }
    setAnswer(json.data.reply);
    setSources(json.data.sources ?? []);
  };

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-[#0f172a]">
        <Bot className="h-4 w-4 text-[#007a5a]" aria-hidden="true" /> Tanya Performa Anda
      </h2>
      <p className="mt-0.5 text-[11px] text-[#64748b]">
        Jawaban memakai data KPI, status harian, kehadiran, cuti, dan pelatihan Anda. Gaji dan BPJS tidak termasuk.
      </p>

      <label className="mt-3 block text-xs font-semibold text-[#475569]" htmlFor="coach-question">
        Pertanyaan tentang performa
      </label>
      <textarea
        id="coach-question"
        rows={2}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Contoh: kenapa status saya merah kemarin?"
        className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
      />

      <button
        type="button"
        disabled={busy}
        onClick={ask}
        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <Send className="h-3 w-3" aria-hidden="true" /> Tanya
      </button>

      {error && <p className="mt-2 text-xs font-semibold text-[#b91c1c]">{error}</p>}

      {answer && (
        <div className="mt-3 rounded-xl bg-[#f8fafc] p-3">
          <p className="whitespace-pre-line text-xs leading-relaxed text-[#0f172a]">{answer}</p>
          {sources.length > 0 && (
            <p className="mt-2 text-[11px] text-[#64748b]">Sumber: {sources.join(', ')}</p>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Mount both in the portal**

```tsx
import PerformanceCoachPanel from '@/components/employee/PerformanceCoachPanel';
import ActivityFeedPanel from '@/components/employee/ActivityFeedPanel';
```

Immediately after `<PerformanceRecapTabs />`:

```tsx
<div className="grid gap-3 lg:grid-cols-2">
  <PerformanceCoachPanel />
  <ActivityFeedPanel />
</div>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/ui/coach-and-feed.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the whole suite and the build**

Run: `npx vitest run`
Expected: green.

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/employee/PerformanceCoachPanel.tsx src/components/employee/ActivityFeedPanel.tsx src/app/dashboard/employee-portal/page.tsx tests/ui/coach-and-feed.test.tsx
git commit -m "feat(ui): AI coach performa + feed aktivitas (PRD v2 fase 3)"
```

---

### Task 9: Supervisor chat UI

**Files:**
- Create: `src/components/employee/ChatDrawer.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx` (add an `ActionCard` + mount)
- Test: `tests/ui/chat-drawer.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/conversations`, `GET/POST /api/v1/conversations/:id/messages`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ChatDrawer from '@/components/employee/ChatDrawer';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/conversations')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'c1', conversationType: 'DIRECT', title: 'Dengan Atasan', lastMessageAt: null, unreadCount: 2 },
      ] } }) } as any;
    }
    return { ok: true, json: async () => ({ data: { items: [
      { id: 'm1', conversationId: 'c1', senderId: 'u2', body: 'Tolong siapkan laporan', attachmentUrl: null, isRecalled: false, sentAt: '2026-10-21T08:00:00Z' },
    ] } }) } as any;
  }));
});

describe('ChatDrawer', () => {
  it('menampilkan percakapan dan pesan', async () => {
    render(<ChatDrawer open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Dengan Atasan')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Tolong siapkan laporan/)).toBeTruthy());
  });

  it('menyediakan input pesan', () => {
    render(<ChatDrawer open onClose={() => {}} />);
    expect(screen.getByLabelText(/Tulis pesan/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/chat-drawer.test.tsx`
Expected: FAIL — cannot resolve `ChatDrawer`.

- [ ] **Step 3: Write the component**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';

interface Conversation {
  id: string;
  conversationType: 'DIRECT' | 'GROUP';
  title: string | null;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  body: string;
  isRecalled: boolean;
  sentAt: string;
}

export default function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/v1/conversations');
    if (!res.ok) return;
    const json = await res.json();
    const items: Conversation[] = json?.data?.items ?? [];
    setConversations(items);
    setActiveId((current) => current ?? items[0]?.id ?? null);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/v1/conversations/${conversationId}/messages`);
    if (!res.ok) { setMessages([]); return; }
    const json = await res.json();
    setMessages((json?.data?.items ?? []).slice().reverse());
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadConversations();
  }, [open, loadConversations]);

  useEffect(() => {
    if (open && activeId) void loadMessages(activeId);
  }, [open, activeId, loadMessages]);

  const send = async () => {
    if (!activeId || draft.trim().length === 0) return;
    setError(null);
    const res = await fetch(`/api/v1/conversations/${activeId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.detail ?? 'Pesan gagal dikirim.'); return; }
    setDraft('');
    await loadMessages(activeId);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] p-4">
          <h2 id="chat-title" className="flex items-center gap-1.5 text-sm font-extrabold text-[#0f172a]">
            <MessageSquare className="h-4 w-4 text-[#007a5a]" aria-hidden="true" /> Chat Pimpinan
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <div className="border-b border-[#e2e8f0] p-2">
          <ul className="flex gap-2 overflow-x-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  aria-pressed={activeId === c.id}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] ${
                    activeId === c.id ? 'bg-[#007a5a] text-white' : 'bg-[#f1f5f9] text-[#475569]'
                  }`}
                >
                  {c.title ?? (c.conversationType === 'DIRECT' ? 'Percakapan langsung' : 'Grup')}
                  {c.unreadCount > 0 ? ` (${c.unreadCount})` : ''}
                </button>
              </li>
            ))}
            {conversations.length === 0 && (
              <li className="px-2 py-1 text-[11px] text-[#64748b]">Belum ada percakapan.</li>
            )}
          </ul>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl bg-[#f8fafc] p-2.5">
              <p className="text-xs text-[#0f172a]">{m.body}</p>
              <p className="mt-1 text-[10px] text-[#94a3b8]">
                {new Date(m.sentAt).toLocaleString('id-ID')}
              </p>
            </div>
          ))}
          {activeId && messages.length === 0 && (
            <p className="text-xs text-[#64748b]">Belum ada pesan.</p>
          )}
        </div>

        <div className="border-t border-[#e2e8f0] p-3">
          <label htmlFor="chat-draft" className="text-[11px] font-semibold text-[#475569]">
            Tulis pesan
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="chat-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              className="flex-1 rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
            <button
              type="button"
              onClick={send}
              aria-label="Kirim pesan"
              className="rounded-lg bg-[#007a5a] p-2 text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="mt-1 text-[11px] font-semibold text-[#b91c1c]">{error}</p>}
          <p className="mt-2 text-[10px] text-[#94a3b8]">
            Chat tidak menggantikan disposisi resmi untuk keputusan yang mengikat.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount it in the portal**

```tsx
import ChatDrawer from '@/components/employee/ChatDrawer';
```

```tsx
const [isChatOpen, setIsChatOpen] = useState(false);
```

```tsx
<ActionCard
  icon={MessageSquare}
  tone="teal"
  title="Chat Pimpinan"
  tag="Komunikasi"
  description="Percakapan langsung atau grup dengan atasan, lengkap dengan riwayat yang tidak bisa dihapus sepihak."
  onClick={() => setIsChatOpen(true)}
/>
```

```tsx
<ChatDrawer open={isChatOpen} onClose={() => setIsChatOpen(false)} />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/ui/chat-drawer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/employee/ChatDrawer.tsx src/app/dashboard/employee-portal/page.tsx tests/ui/chat-drawer.test.tsx
git commit -m "feat(ui): chat pimpinan (PRD v2 fase 3)"
```

---

### Task 10: Company-wide activity feed for HRD and leadership

**Files:**
- Create: `src/app/api/v1/activity-feed/company/route.ts`
- Create: `src/components/governance/CompanyActivityFeed.tsx`
- Modify: `src/app/dashboard/hr-command/page.tsx` (mount the panel)
- Test: `tests/api/activity-feed-company.test.ts`

**Interfaces:**
- Consumes: `activity_events`.
- Produces: `GET /api/v1/activity-feed/company?limit=200` — never returns `RESTRICTED`, requires `analytics:read`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { appendActivity } from '@/lib/services/activityFeedService';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getCompany } from '@/app/api/v1/activity-feed/company/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('company activity feed', () => {
  let client: PGlite;
  let db: any;
  let hrCookie = '';
  let empCookie = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    await appendActivity(db, { employeeId: BUDI, eventType: 'KPI_DAILY', summary: 'Mengirim 2 indikator' });
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('HR melihat feed lintas karyawan', async () => {
    const res = await getCompany(getReq('/api/v1/activity-feed/company', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('karyawan ditolak', async () => {
    const res = await getCompany(getReq('/api/v1/activity-feed/company', empCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('tidak pernah memuat RESTRICTED', async () => {
    await db.execute(`
      INSERT INTO activity_events (employee_id, event_type, summary, visibility)
      VALUES ('${BUDI}', 'KPI_DAILY', 'gaji naik', 'RESTRICTED')`);
    const res = await getCompany(getReq('/api/v1/activity-feed/company', hrCookie));
    const json = await res.json();
    expect(json.data.items.some((e: any) => e.visibility === 'RESTRICTED')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/activity-feed-company.test.ts`
Expected: FAIL — cannot resolve the route.

- [ ] **Step 3: Write the route**

```ts
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 200) || 200, 500);

    const res = (await db.execute(sql`
      SELECT a.id, a.employee_id AS "employeeId", e.full_name AS "employeeName",
             a.event_type AS "eventType", a.summary, a.visibility,
             a.occurred_at AS "occurredAt"
        FROM activity_events a
        JOIN employees e ON e.id = a.employee_id
       WHERE a.visibility <> 'RESTRICTED'
       ORDER BY a.occurred_at DESC
       LIMIT ${limit}
    `)) as unknown as { rows: unknown[] };

    return ok({ items: res.rows ?? [] });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat feed perusahaan', status);
  }
}
```

- [ ] **Step 4: Write `CompanyActivityFeed`**

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Event {
  id: string;
  employeeName: string;
  eventType: string;
  summary: string;
  occurredAt: string;
}

const LABEL: Record<string, string> = {
  ATTENDANCE: 'Kehadiran', KPI_DAILY: 'KPI harian', DPI_STATUS: 'Status harian',
  LEAVE: 'Cuti', OVERTIME: 'Lembur', TRAINING: 'Pelatihan', LETTER: 'Surat',
  DISCIPLINARY: 'Sanksi', RECOGNITION: 'Penghargaan', CAREER: 'Karir',
};

export default function CompanyActivityFeed() {
  const [items, setItems] = useState<Event[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/activity-feed/company?limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setItems(j?.data?.items ?? []); })
      .catch(() => { /* biarkan kosong */ });
    return () => { active = false; };
  }, []);

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Aktivitas Karyawan Terkini</h2>
      <p className="mt-0.5 text-[11px] text-[#64748b]">
        Kejadian lintas modul. Data gaji, BPJS, dan chat pribadi tidak pernah muncul di sini.
      </p>

      <ul className="mt-3 divide-y divide-[#e2e8f0]">
        {items.map((e) => (
          <li key={e.id} className="py-2 text-xs">
            <span className="font-semibold text-[#0f172a]">{e.employeeName}</span>
            {' · '}
            <span className="text-[#475569]">{LABEL[e.eventType] ?? e.eventType}: {e.summary}</span>
            <span className="ml-2 text-[10px] text-[#94a3b8]">
              {new Date(e.occurredAt).toLocaleString('id-ID')}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-xs text-[#64748b]">Belum ada aktivitas.</li>}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Mount it in the HR command dashboard**

```tsx
import CompanyActivityFeed from '@/components/governance/CompanyActivityFeed';
```

```tsx
<CompanyActivityFeed />
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/api/activity-feed-company.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/v1/activity-feed/company src/components/governance/CompanyActivityFeed.tsx src/app/dashboard/hr-command/page.tsx tests/api/activity-feed-company.test.ts
git commit -m "feat(feed): feed aktivitas lintas karyawan untuk HRD (PRD v2 fase 3)"
```

---

## Phase 3 completion checklist

- [ ] `npx vitest run` green and `npm run build` succeeds.
- [ ] Migrations `0050`–`0050` apply on a fresh PGlite and on PostgreSQL.
- [ ] PRD §8 criteria for e-Surat & Disposisi, Chat Pimpinan, Policy Acknowledgment, AI Performance Coach, and Activity Feed each map to a passing test above.
- [ ] The AI leak test fails if anyone adds a restricted column to `buildCoachContext`.
- [ ] All three phases shipped: points 1–9 of Revisi 2 are implemented and each is covered by a named test.
