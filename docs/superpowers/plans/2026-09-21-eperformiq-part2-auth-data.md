# Implementation Plan — Bagian 2: Auth, RBAC & Lapisan Data

> Lanjutan dari `2026-09-21-eperformiq-database-and-flow-integration.md`.
> **Untuk agen pelaksana:** gunakan superpowers:subagent-driven-development atau superpowers:executing-plans.
> Prasyarat: Task 1–4 (fondasi, skema, password, seed) selesai dan tesnya hijau.

---

### Task 5: Sesi JWT

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `tests/unit/session.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces:
  - `type SessionPayload = { userId: string; employeeId: string | null; role: UserRole; email: string }`
  - `signSession(payload: SessionPayload, ttl?: string): Promise<string>`
  - `verifySession(token: string): Promise<SessionPayload | null>`
  - `SESSION_COOKIE_NAME = 'eperformiq_token'`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/unit/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signSession, verifySession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

const PAYLOAD = {
  userId: 'u-1',
  employeeId: 'e-1',
  role: 'EMPLOYEE' as const,
  email: 'uji@x.id',
};

describe('sesi JWT', () => {
  it('menandatangani lalu memverifikasi payload yang sama', async () => {
    const token = await signSession(PAYLOAD);
    expect(await verifySession(token)).toMatchObject(PAYLOAD);
  });

  it('mengembalikan null untuk tanda tangan yang rusak', async () => {
    const token = await signSession(PAYLOAD);
    expect(await verifySession(token.slice(0, -4) + 'XXXX')).toBeNull();
  });

  it('mengembalikan null untuk token kedaluwarsa', async () => {
    expect(await verifySession(await signSession(PAYLOAD, '-1s'))).toBeNull();
  });

  it('mengembalikan null untuk string sembarang, bukan melempar', async () => {
    expect(await verifySession('bukan.token.jwt')).toBeNull();
    expect(await verifySession('')).toBeNull();
  });

  it('memakai nama cookie yang konsisten', () => {
    expect(SESSION_COOKIE_NAME).toBe('eperformiq_token');
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/unit/session.test.ts
```

Diharapkan: GAGAL dengan `Cannot find module '@/lib/auth/session'`.

- [ ] **Step 3: Implementasi**

`src/lib/auth/session.ts`:

```ts
import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@/types';

export const SESSION_COOKIE_NAME = 'eperformiq_token';
const ALG = 'HS256';
const DEFAULT_TTL = '8h';

export type SessionPayload = {
  userId: string;
  employeeId: string | null;
  role: UserRole;
  email: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? 'dev-only-secret-ganti-di-produksi';
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET wajib diisi di produksi');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
  ttl: string = DEFAULT_TTL
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getSecret());
}

/**
 * Mengembalikan null untuk token tidak valid ATAU kedaluwarsa. Pemanggil
 * tidak perlu membedakan keduanya — dua-duanya berarti "belum
 * terautentikasi" (Review Focus butir 4).
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      employeeId: (payload.employeeId as string | null) ?? null,
      role: payload.role as UserRole,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

```bash
npx vitest run tests/unit/session.test.ts
```

Diharapkan: **5 tes LULUS**.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: sesi JWT dengan jose"
```

---

### Task 6: Kelas Error Domain

**Files:**
- Create: `src/lib/auth/errors.ts`
- Create: `tests/unit/errors.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ImmutableRecordError` (409), `BusinessRuleError` (422) — masing-masing membawa `status` dan `title`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/unit/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  AuthError, ForbiddenError, NotFoundError,
  ImmutableRecordError, BusinessRuleError,
} from '@/lib/auth/errors';

describe('kelas error domain', () => {
  it('memetakan setiap kelas ke kode status yang benar', () => {
    expect(new AuthError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(new NotFoundError().status).toBe(404);
    expect(new ImmutableRecordError('x').status).toBe(409);
    expect(new BusinessRuleError('x').status).toBe(422);
  });

  it('mempertahankan pesan kustom', () => {
    expect(new BusinessRuleError('Total bobot 110% melebihi 100%').message)
      .toBe('Total bobot 110% melebihi 100%');
  });

  it('merupakan instanceof Error', () => {
    expect(new ForbiddenError()).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/unit/errors.test.ts
```

Diharapkan: GAGAL dengan `Cannot find module '@/lib/auth/errors'`.

- [ ] **Step 3: Implementasi**

`src/lib/auth/errors.ts`:

```ts
export class AuthError extends Error {
  status = 401;
  title = 'Unauthorized';
  constructor(message = 'Sesi tidak valid atau telah berakhir.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  status = 403;
  title = 'Forbidden';
  constructor(message = 'Anda tidak memiliki otorisasi untuk tindakan ini.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  status = 404;
  title = 'Not Found';
  constructor(message = 'Data tidak ditemukan.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ImmutableRecordError extends Error {
  status = 409;
  title = 'Immutable Appraisal Record';
  constructor(message: string) {
    super(message);
    this.name = 'ImmutableRecordError';
  }
}

/** 422: sintaks valid, aturan bisnis dilanggar. */
export class BusinessRuleError extends Error {
  status = 422;
  title = 'Business Rule Violation';
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

```bash
npx vitest run tests/unit/errors.test.ts
```

Diharapkan: **3 tes LULUS**.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: kelas error domain dengan kode status RFC 7807"
```

---

### Task 7: Matriks RBAC

**Files:**
- Create: `src/lib/auth/rbac.ts`
- Create: `tests/unit/rbac.test.ts`

**Interfaces:**
- Consumes: `ForbiddenError` (Task 6), `SessionPayload` (Task 5)
- Produces:
  - `type Permission = 'kpi:read' | 'kpi:write' | 'kpi:approve' | 'appraisal:calculate' | 'appraisal:calibrate' | 'audit:read'`
  - `can(role: UserRole, permission: Permission): boolean`
  - `assertCan(session: SessionPayload, permission: Permission): void` — melempar `ForbiddenError`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/unit/rbac.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { can, assertCan } from '@/lib/auth/rbac';
import { ForbiddenError } from '@/lib/auth/errors';

const session = (role: string) => ({ userId: 'u', employeeId: 'e', role: role as any, email: 'x@y.z' });

describe('matriks RBAC', () => {
  it('EMPLOYEE boleh baca & tulis KPI, tidak boleh menyetujui atau kalibrasi', () => {
    expect(can('EMPLOYEE', 'kpi:read')).toBe(true);
    expect(can('EMPLOYEE', 'kpi:write')).toBe(true);
    expect(can('EMPLOYEE', 'kpi:approve')).toBe(false);
    expect(can('EMPLOYEE', 'appraisal:calibrate')).toBe(false);
  });

  it('PEOPLE_MANAGER boleh menyetujui KPI & menghitung GPA, tidak boleh kalibrasi', () => {
    expect(can('PEOPLE_MANAGER', 'kpi:approve')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'appraisal:calculate')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'appraisal:calibrate')).toBe(false);
  });

  it('HR_MANAGER dan BOD boleh kalibrasi', () => {
    expect(can('HR_MANAGER', 'appraisal:calibrate')).toBe(true);
    expect(can('BOD', 'appraisal:calibrate')).toBe(true);
  });

  it('AUDITOR hanya boleh membaca audit log', () => {
    expect(can('AUDITOR', 'audit:read')).toBe(true);
    expect(can('AUDITOR', 'kpi:write')).toBe(false);
    expect(can('AUDITOR', 'appraisal:calibrate')).toBe(false);
  });

  it('BOD tidak boleh menulis KPI', () => {
    expect(can('BOD', 'kpi:write')).toBe(false);
  });

  it('SUPER_ADMIN boleh semuanya', () => {
    expect(can('SUPER_ADMIN', 'kpi:write')).toBe(true);
    expect(can('SUPER_ADMIN', 'appraisal:calibrate')).toBe(true);
    expect(can('SUPER_ADMIN', 'audit:read')).toBe(true);
  });

  it('assertCan melempar ForbiddenError beserta nama permission', () => {
    expect(() => assertCan(session('EMPLOYEE'), 'appraisal:calibrate'))
      .toThrow(ForbiddenError);
    expect(() => assertCan(session('EMPLOYEE'), 'appraisal:calibrate'))
      .toThrow(/appraisal:calibrate/);
  });

  it('assertCan tidak melempar untuk role yang berwenang', () => {
    expect(() => assertCan(session('HR_MANAGER'), 'appraisal:calibrate')).not.toThrow();
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/unit/rbac.test.ts
```

Diharapkan: GAGAL dengan `Cannot find module '@/lib/auth/rbac'`.

- [ ] **Step 3: Implementasi**

`src/lib/auth/rbac.ts`:

```ts
import type { UserRole } from '@/types';
import { ForbiddenError } from './errors';
import type { SessionPayload } from './session';

export type Permission =
  | 'kpi:read'
  | 'kpi:write'
  | 'kpi:approve'
  | 'appraisal:calculate'
  | 'appraisal:calibrate'
  | 'audit:read';

/** Satu matriks deklaratif, bukan `if` tersebar di 18 route (spec §6.2). */
const MATRIX: Record<Permission, ReadonlyArray<UserRole>> = {
  'kpi:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR'],
  'kpi:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
  'kpi:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
  'appraisal:calculate': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
  'appraisal:calibrate': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD'],
  'audit:read': ['SUPER_ADMIN', 'AUDITOR'],
};

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[permission].includes(role);
}

export function assertCan(session: SessionPayload, permission: Permission): void {
  if (!can(session.role, permission)) {
    throw new ForbiddenError(
      `Peran '${session.role}' tidak memiliki otorisasi '${permission}'.`
    );
  }
}
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

```bash
npx vitest run tests/unit/rbac.test.ts
```

Diharapkan: **8 tes LULUS**.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: matriks RBAC deklaratif"
```

---

### Task 8: Row-Level Scope

Ini yang menutup lubang otorisasi: saat ini `GET /individual-kpis` menerima `employee_id` apa pun tanpa cek kepemilikan.

**Files:**
- Create: `src/lib/auth/scope.ts`
- Create: `tests/integration/scope.test.ts`

**Interfaces:**
- Consumes: `Db` (Task 1), `SessionPayload` (Task 5), `runSeed` (Task 4)
- Produces:
  - `type VisibleScope = string[] | 'ALL'`
  - `resolveVisibleEmployeeIds(db: Db, session: SessionPayload): Promise<VisibleScope>`
  - `assertEmployeeVisible(scope: VisibleScope, employeeId: string): void` — melempar `ForbiddenError`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/integration/scope.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ForbiddenError } from '@/lib/auth/errors';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const ANISA = 'b0000000-0000-4000-8000-000000000007';
const RIAN = 'b0000000-0000-4000-8000-000000000009';
const CEO = 'b0000000-0000-4000-8000-000000000001';

const sess = (role: string, employeeId: string | null): SessionPayload => ({
  userId: `u-${role}`, employeeId, role: role as any, email: 'x@y.z',
});

describe('row-level scope', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => { await client.close(); });

  it('EMPLOYEE hanya melihat dirinya sendiri', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(scope).toEqual([BUDI]);
  });

  it('EMPLOYEE tidak melihat rekan kerja', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(scope).not.toContain(ANISA);
  });

  it('PEOPLE_MANAGER melihat dirinya + seluruh bawahan langsung', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('PEOPLE_MANAGER', DANU));
    expect(scope).toEqual(expect.arrayContaining([DANU, BUDI, ANISA, RIAN]));
    expect(scope).not.toContain(CEO); // atasannya sendiri tidak termasuk
  });

  it('HR_MANAGER, BOD, AUDITOR, SUPER_ADMIN melihat seluruh organisasi', async () => {
    for (const role of ['HR_MANAGER', 'BOD', 'AUDITOR', 'SUPER_ADMIN']) {
      expect(await resolveVisibleEmployeeIds(db, sess(role, null))).toBe('ALL');
    }
  });

  it('assertEmployeeVisible melempar 403 untuk karyawan di luar scope', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(() => assertEmployeeVisible(scope, ANISA)).toThrow(ForbiddenError);
  });

  it('assertEmployeeVisible tidak melempar untuk karyawan di dalam scope', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(() => assertEmployeeVisible(scope, BUDI)).not.toThrow();
  });

  it('assertEmployeeVisible tidak melempar saat scope ALL', () => {
    expect(() => assertEmployeeVisible('ALL', ANISA)).not.toThrow();
  });

  it('berhenti pada kedalaman 5 saat hierarki melingkar', async () => {
    // Review Focus butir 3: A atasan B, B atasan A.
    await client.exec(`
      ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_manager_id_fkey;
      UPDATE employees SET manager_id = '${BUDI}' WHERE id = '${DANU}';
      UPDATE employees SET manager_id = '${DANU}' WHERE id = '${BUDI}';
    `);

    const start = Date.now();
    const scope = await resolveVisibleEmployeeIds(db, sess('PEOPLE_MANAGER', DANU));
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000); // tidak menggantung
    expect(Array.isArray(scope)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/integration/scope.test.ts
```

Diharapkan: GAGAL dengan `Cannot find module '@/lib/auth/scope'`.

- [ ] **Step 3: Implementasi**

`src/lib/auth/scope.ts`:

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from './session';
import { ForbiddenError } from './errors';

export type VisibleScope = string[] | 'ALL';

/** Role yang melihat seluruh organisasi (spec §6.3). */
const ORG_WIDE_ROLES = ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'AUDITOR'] as const;

/**
 * Recursive CTE dengan batas kedalaman 5. Batas ini mencegah query
 * menggantung selamanya bila data manager_id melingkar
 * (Review Focus butir 3).
 */
const MAX_DEPTH = 5;

export async function resolveVisibleEmployeeIds(
  db: Db,
  session: SessionPayload
): Promise<VisibleScope> {
  if ((ORG_WIDE_ROLES as readonly string[]).includes(session.role)) return 'ALL';

  if (!session.employeeId) return [];

  if (session.role === 'EMPLOYEE') return [session.employeeId];

  const result = await db.execute(sql`
    WITH RECURSIVE subordinates AS (
      SELECT id, manager_id, 0 AS depth
        FROM employees
       WHERE id = ${session.employeeId}
      UNION ALL
      SELECT e.id, e.manager_id, s.depth + 1
        FROM employees e
        JOIN subordinates s ON e.manager_id = s.id
       WHERE s.depth < ${MAX_DEPTH}
    )
    SELECT id FROM subordinates
  `);

  return (result.rows as Array<{ id: string }>).map((r) => r.id);
}

export function assertEmployeeVisible(scope: VisibleScope, employeeId: string): void {
  if (scope === 'ALL') return;
  if (!scope.includes(employeeId)) {
    throw new ForbiddenError(
      'Anda tidak memiliki otorisasi untuk mengakses data karyawan ini.'
    );
  }
}
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

```bash
npx vitest run tests/integration/scope.test.ts
```

Diharapkan: **8 tes LULUS**. Tes terakhir membuktikan hierarki melingkar tidak menggantung.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: row-level scope dengan proteksi hierarki melingkar"
```

---

### Task 9: Envelope Response & Validasi

**Files:**
- Create: `src/lib/api/response.ts`
- Create: `src/lib/api/validate.ts`
- Create: `tests/unit/response.test.ts`

**Interfaces:**
- Consumes: kelas error (Task 6)
- Produces:
  - `ok<T>(data: T, init?: ResponseInit): NextResponse`
  - `problem(error: unknown, instance: string): NextResponse`
  - `parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T>` — melempar `BusinessRuleError` dengan detail field

- [ ] **Step 1: Tulis tes yang gagal**

`tests/unit/response.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ok, problem, parseBody } from '@/lib/api/response';
import { BusinessRuleError, NotFoundError } from '@/lib/auth/errors';

describe('envelope response', () => {
  it('membungkus sukses dalam { status, data }', async () => {
    const res = ok({ nilai: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'success', data: { nilai: 1 } });
  });

  it('menghormati status kustom', () => {
    expect(ok({}, { status: 201 }).status).toBe(201);
  });

  it('memetakan error domain ke RFC 7807', async () => {
    const res = problem(new NotFoundError('KPI tidak ditemukan'), '/api/v1/uji');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({
      title: 'Not Found',
      status: 404,
      detail: 'KPI tidak ditemukan',
      instance: '/api/v1/uji',
    });
    expect(body.type).toContain('not-found');
    expect(typeof body.timestamp).toBe('string');
  });

  it('memetakan error tak dikenal menjadi 500 tanpa membocorkan pesan internal', async () => {
    const res = problem(new Error('rahasia database'), '/api/v1/uji');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('rahasia database');
  });

  it('parseBody mengembalikan data valid', async () => {
    const schema = z.object({ nama: z.string() });
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ nama: 'Budi' }),
    });
    expect(await parseBody(req, schema)).toEqual({ nama: 'Budi' });
  });

  it('parseBody melempar BusinessRuleError 422 untuk data tidak valid', async () => {
    const schema = z.object({ nama: z.string().min(1) });
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ nama: '' }),
    });
    await expect(parseBody(req, schema)).rejects.toThrow(BusinessRuleError);
  });

  it('parseBody menyebut nama field yang bermasalah', async () => {
    const schema = z.object({ kpi_weight: z.number().max(100) });
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ kpi_weight: 150 }),
    });
    await expect(parseBody(req, schema)).rejects.toThrow(/kpi_weight/);
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/unit/response.test.ts
```

Diharapkan: GAGAL dengan `Cannot find module '@/lib/api/response'`.

- [ ] **Step 3: Implementasi**

`src/lib/api/response.ts`:

```ts
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { BusinessRuleError } from '@/lib/auth/errors';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ status: 'success', data }, init);
}

const TYPE_SLUG: Record<number, string> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'immutable-record',
  422: 'business-rule-violation',
  500: 'internal-error',
};

/**
 * Memetakan error domain ke RFC 7807. Error tak dikenal menjadi 500
 * TANPA membocorkan pesan internal ke klien.
 */
export function problem(error: unknown, instance: string): NextResponse {
  const isDomain =
    error instanceof Error &&
    typeof (error as { status?: unknown }).status === 'number';

  const status = isDomain ? (error as unknown as { status: number }).status : 500;
  const title = isDomain
    ? (error as unknown as { title: string }).title
    : 'Internal Server Error';
  const detail = isDomain
    ? (error as Error).message
    : 'Terjadi kesalahan internal pada server. Silakan coba kembali.';

  if (!isDomain) console.error(`[${instance}]`, error);

  return NextResponse.json(
    {
      type: `https://api.e-performiq.com/errors/${TYPE_SLUG[status] ?? 'error'}`,
      title,
      status,
      detail,
      instance,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new BusinessRuleError('Body request bukan JSON yang valid.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new BusinessRuleError(`Input tidak valid — ${detail}`);
  }
  return parsed.data;
}
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

```bash
npx vitest run tests/unit/response.test.ts
```

Diharapkan: **7 tes LULUS**.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: envelope response RFC 7807 dan validasi zod"
```

---

**Lanjutan:** Task 10–15 ada di `2026-09-21-eperformiq-part3-services-routes-ui.md`.