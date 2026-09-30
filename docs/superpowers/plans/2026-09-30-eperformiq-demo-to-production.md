# E-PerformIQ — Demo → Production-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make E-PerformIQ a working, test-green, DB-driven application (demo → ready-to-use) by fixing the seed blocker, replacing hardcoded data with real DB queries, adding a functional governance chatbot and server-side role gating, cleaning stale files, and enabling an optional PostgreSQL-server driver — without rewriting existing code.

**Architecture:** Next.js 14 App Router (TS) + Drizzle ORM over PGlite (in-process PostgreSQL 16 WASM), plus a dual-driver seam so the same schema/migrations/queries run on a PostgreSQL server when `DATABASE_URL` is set. Business logic lives in pure engines + services; API routes are thin adapters using `ok/fail` + RFC7807 envelopes, RBAC via `assertCan`, and row-level scope via `scope.ts`. Every task is TDD: failing test → minimal implementation → green → commit.

**Tech Stack:** Next.js 14, React 18, TypeScript 5.6, Drizzle ORM 0.36, PGlite 0.2, `postgres` (postgres-js, NEW), Vitest 2, Tailwind 3, `jose` (JWT), `bcryptjs`, `zod`.

**Spec:** `docs/superpowers/specs/2026-09-30-eperformiq-demo-to-production-design.md`

## Global Constraints

- Node 18+; all code TypeScript. Follow the patterns of the file you edit.
- Responses: always `ok(data, message?)` / `fail(code, message, status)` from `src/lib/api/response.ts`; thrown domain errors → `problem(error, instance)` (RFC 7807).
- RBAC: every protected route calls `assertCan(role, permission)` from `src/lib/auth/rbac.ts`. Scope: every employee-scoped read/write uses `assertEmployeeVisible` / scope helpers from `src/lib/auth/scope.ts`.
- Migrations: every statement MUST be idempotent (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`, `DROP TRIGGER IF EXISTS`) — see ADR `docs/decisions/003-pglite-migration-idempotency.md`. New migrations numbered sequentially (`0006_...`).
- Migrations tracked in `__migrations`; run `npm run db:migrate` after adding one.
- Tests: unit tests avoid DB; integration tests use `createTestDb()` from `tests/setup.ts` (fresh in-memory PGlite + migrations). Never touch `.pglite/` in tests.
- Test command: `npx vitest run` (or `npm run test`). Build/type-check: `npm run build`.
- Repos that already take `db: Db` keep that signature. Pure services stay arg-free; persistence services call `getDb()`.
- Do not delete `src/lib/dummy-data/index.ts` until Task 4 replaces its consumers.

## Review Focus

Inputs/conditions the spec implies but no single task's happy path covers — each line has a test in the owning task:

1. **Empty dataset** — a fresh DB with zero appraisals/KPIs/attendance: dashboard aggregates must return 0 / null-safe values, never crash or divide by zero. (Task 6, Task 7, Task 8)
2. **Out-of-scope access** — a PEOPLE_MANAGER or EMPLOYEE requesting another employee's scorecard/chatbot data must get 403, not data. (Task 8, Task 10)
3. **Unlinked/zero-weight KPI** — KPI with `target_value = 0` or missing pillar must not produce NaN/Infinity in VMAI/GPA. (Task 6; partly covered by `engines.test.ts`)
4. **Expired/tampered session** — middleware must reject a bad JWT and redirect, not pass through on cookie presence. (Task 11)
5. **Concurrent/no-DATABASE_URL** — dual-driver test must skip cleanly (not error) when `DATABASE_URL` is unset, and PGlite path must remain default. (Task 12)

---

## WS-0 — Fix Seed Blocker (do first, unblocks the suite)

### Task 1: Repair the `performance_appraisals` seed row

**Files:**
- Modify: `src/lib/db/seed/index.ts` (the `INSERT INTO performance_appraisals` statement)
- Test: `tests/integration/seed.test.ts` (existing, currently failing)

**Interfaces:**
- Consumes: `runSeed(client)` from `src/lib/db/seed/index.ts`; `createTestDb()` from `tests/setup.ts`.
- Produces: a seed that completes without error; `performance_appraisals` has exactly 1 row for Budi (`b0000000-0000-4000-8000-000000000004`).

- [ ] **Step 1: Run the existing failing test to confirm the failure mode**

Run: `npx vitest run tests/integration/seed.test.ts -v`
Expected: FAIL — seed throws `error: INSERT has more expressions than target columns` (16 columns, 17 values).

- [ ] **Step 2: Fix the seed row (minimal implementation)**

The header has 16 columns and the VALUES row has 17 (an extra 4th UUID before `92.50`). Replace the malformed row so `employee_id` is Budi and the stray CEO UUID is removed:

```sql
-- Budi's Performance Appraisal (PRD §11.3 values)
INSERT INTO performance_appraisals (id, period_id, employee_id, kpi_composite_score, sop_compliance_score, competency_score, core_values_score, total_percentage_score, composite_gpa, performance_rating, potential_score, nine_box_quadrant, is_calibrated, calibrated_by, calibrated_at, calibration_notes) VALUES
  ('40000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004',92.50,96.00,85.00,90.00,91.70,3.67,'A',4.20,'FUTURE_LEADER',TRUE,'e0000000-0000-4000-8000-000000000002','2026-09-18T10:00:00Z','Dikalibrasi oleh Komite Kinerja Human Capital')
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run tests/integration/seed.test.ts -v`
Expected: PASS (all `seed data` cases green).

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/seed/index.ts
git commit -m "fix(seed): remove stray UUID in performance_appraisals row (16 cols/17 vals)"
```

---

### Task 2: Green the remaining seed-dependent suites

**Files:**
- Test (verify only): `tests/integration/seed-govera.test.ts`, `tests/integration/services.test.ts`, `tests/integration/services-extended.test.ts`, `tests/integration/scope.test.ts`, `tests/api/routes.test.ts`, `tests/api/cross-scope-access.test.ts`
- Modify (only if a genuine second bug surfaces): `src/lib/services/coreHrService.ts`, `tests/integration/flightRisk-with-attendance.test.ts`

**Interfaces:**
- Consumes: the fixed seed (Task 1).
- Produces: `npx vitest run` with 0 failures.

- [ ] **Step 1: Run the full suite and capture the failure list**

Run: `npx vitest run --reporter=basic`
Expected: identify which previously-failing suites now pass and which still fail.

- [ ] **Step 2: Investigate any remaining failure individually**

For each still-failing test, run it alone (`npx vitest run <path> -v`) and read the assertion. Do NOT change source to make a wrong test pass; fix the actual defect.

- [ ] **Step 3: Fix the Bradford flight-risk failure if it persists**

Baseline symptom: `expected +0 to be 1` in `tests/integration/flightRisk-with-attendance.test.ts:49`. Read `src/lib/services/attendanceService.ts` (`getAttendanceFactRows`, `computeBradfordFactor`). Contract: an avala (`is_present = FALSE`, `is_sick_leave = FALSE`) counts as 1 absence instance → `1^2 × 1 = 1`; sick leave must NOT increase Bradford. Align the counting with that contract. If the test encodes a wrong expectation, correct the test and say so in the commit body.

- [ ] **Step 4: Run the suite again**

Run: `npx vitest run --reporter=basic`
Expected: 0 failed test files.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: green suite after seed fix; correct Bradford factor counting"
```

---

## WS-5 — Repo Cleanup

### Task 3: Remove stale `.bak` files

**Files:**
- Delete: every `*.bak` under `src/**` and `tests/**` (approx 22 files), including `src/lib/db/seed/index.ts.bak`, `src/lib/db/migrations/0001_init.sql.bak`, `src/lib/services/*.bak`, `src/lib/auth/rbac.ts.bak`, `tests/**/*.test.ts.bak`.

**Interfaces:**
- Consumes: nothing.
- Produces: no `.bak` files remain; suite still green.

- [ ] **Step 1: List all `.bak` files**

Run: `Get-ChildItem -Recurse -Filter *.bak -File | Select-Object FullName`

- [ ] **Step 2: Delete them**

Run: `Get-ChildItem -Recurse -Include *.bak -File | Remove-Item -Force`

- [ ] **Step 3: Verify the suite is unaffected**

Run: `npx vitest run --reporter=basic`
Expected: same result as Task 2.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove stale .bak files"
```

---

### Task 4: Retire dead `dummy-data` exports, keep a clear demo-accounts constant

**Files:**
- Modify: `src/lib/dummy-data/index.ts` (keep only the user list; rename export to `DEMO_LOGIN_ACCOUNTS`; delete the other 15 `DUMMY_*` exports).
- Modify: `src/app/login/page.tsx` (import + render), `src/components/navigation/Header.tsx` (import + role dropdown), `src/lib/context/AuthContext.tsx` (import + symbol only; auth-state change is Task 11).
- Test: `tests/integration/seed.test.ts` (add sync test).

**Interfaces:**
- Produces: `export const DEMO_LOGIN_ACCOUNTS: ReadonlyArray<{ email: string; role: UserRole; label: string }>` from `@/lib/dummy-data`.

- [ ] **Step 1: Write a test asserting demo accounts match seed emails**

Add to `tests/integration/seed.test.ts`:

```ts
it('akun demo login sinkron dengan email seed', async () => {
  const { DEMO_LOGIN_ACCOUNTS } = await import('@/lib/dummy-data');
  const seedEmails = new Set(SEED_USER_EMAILS.map((u) => u.email));
  for (const acc of DEMO_LOGIN_ACCOUNTS) {
    expect(seedEmails.has(acc.email)).toBe(true);
  }
  expect(DEMO_LOGIN_ACCOUNTS.length).toBeGreaterThanOrEqual(7);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/seed.test.ts -v`
Expected: FAIL — `DEMO_LOGIN_ACCOUNTS` is not exported.

- [ ] **Step 3: Rewrite `src/lib/dummy-data/index.ts`**

Keep only the user list, rename it, add labels, delete all other `DUMMY_*` exports:

```ts
import type { UserRole } from '@/types';

export interface DemoLoginAccount {
  email: string;
  role: UserRole;
  label: string;
}

/** Akun demo (dev/seed). Bukan data bisnis - hanya untuk login cepat. */
export const DEMO_LOGIN_ACCOUNTS: ReadonlyArray<DemoLoginAccount> = [
  { email: 'hendra.gunawan@eperformiq.co.id', role: 'BOD', label: 'Dewan Direksi (BOD)' },
  { email: 'siti.nurhaliza@eperformiq.co.id', role: 'HR_MANAGER', label: 'HR Manager' },
  { email: 'danu.tech@eperformiq.co.id', role: 'PEOPLE_MANAGER', label: 'People Manager' },
  { email: 'budi.pratama@eperformiq.co.id', role: 'EMPLOYEE', label: 'Karyawan' },
  { email: 'bambang.audit@eperformiq.co.id', role: 'AUDITOR', label: 'Auditor Internal' },
  { email: 'admin@eperformiq.co.id', role: 'SUPER_ADMIN', label: 'Super Admin' },
  { email: 'aris.assessor@eperformiq.co.id', role: 'ASSESSOR', label: 'Assessor' },
];
```

- [ ] **Step 4: Update the three consumers**

Replace `DUMMY_USERS` import/usage with `DEMO_LOGIN_ACCOUNTS` in `src/app/login/page.tsx`, `src/components/navigation/Header.tsx`, `src/lib/context/AuthContext.tsx`.

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run tests/integration/seed.test.ts -v && npm run build`
Expected: PASS and successful build.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: replace dead dummy-data exports with DEMO_LOGIN_ACCOUNTS"
```

---

## WS-6 — PKWT Contract Column

### Task 5: Add `employees.contract_end_date` and compute real `contractDaysRemaining`

**Files:**
- Create: `src/lib/db/migrations/0006_contract_end_date.sql`
- Modify: `src/lib/db/seed/index.ts` (set `contract_end_date` for CONTRACT/PROBATION employees)
- Modify: `src/lib/services/coreHrService.ts` (`buildRiskProfile`)
- Test: `tests/integration/govera-0006-schema.test.ts` (new), `tests/unit/coreHrService.test.ts` (add case)

**Interfaces:**
- Consumes: `runMigrations`, `createTestDb()`.
- Produces: `computeContractDaysRemaining(contractEndDate, now?)` from `coreHrService.ts`; `EmployeeRiskProfile.contractDaysRemaining` computed from `employees.contract_end_date` (0 when null).

- [ ] **Step 1: Write the failing schema test**

Create `tests/integration/govera-0006-schema.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

describe('migration 0006: contract_end_date', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); });
  afterAll(async () => { await client.close(); });

  it('menambahkan kolom contract_end_date bertipe date', async () => {
    const res = await client.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'contract_end_date'`
    );
    expect(res.rows[0]?.data_type).toBe('date');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/govera-0006-schema.test.ts -v`
Expected: FAIL — column does not exist.

- [ ] **Step 3: Create the migration (idempotent)**

Create `src/lib/db/migrations/0006_contract_end_date.sql`:

```sql
-- 0006: kolom akhir kontrak PKWT untuk contractDaysRemaining (Flight Risk)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;
```

- [ ] **Step 4: Verify schema test passes**

Run: `npx vitest run tests/integration/govera-0006-schema.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Write a failing unit test for contract-day computation**

Add to `tests/unit/coreHrService.test.ts`:

```ts
import { computeContractDaysRemaining } from '@/lib/services/coreHrService';

it('menghitung sisa hari kontrak dari tanggal akhir', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  expect(computeContractDaysRemaining('2026-10-30', now)).toBe(30);
  expect(computeContractDaysRemaining(null, now)).toBe(0);
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/unit/coreHrService.test.ts -v`
Expected: FAIL — `computeContractDaysRemaining` not exported.

- [ ] **Step 7: Implement the helper and wire it in**

Add to `src/lib/services/coreHrService.ts`:

```ts
/** Sisa hari sampai kontrak berakhir; 0 bila tidak ada tanggal kontrak. */
export function computeContractDaysRemaining(
  contractEndDate: string | null | undefined,
  now: Date = new Date()
): number {
  if (!contractEndDate) return 0;
  const end = new Date(`${contractEndDate}T00:00:00Z`).getTime();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((end - start) / 86400000));
}
```

In `buildRiskProfile`, replace the `contractDaysRemaining: 0,` line (and its TODO comment) with a real read:

```ts
const contract = (await db.execute(sql`
  SELECT contract_end_date AS "contractEndDate"
    FROM employees WHERE id = ${employeeId}::uuid
`)) as unknown as { rows: Array<{ contractEndDate: string | null }> };

// ...
contractDaysRemaining: computeContractDaysRemaining(contract.rows[0]?.contractEndDate ?? null),
```

- [ ] **Step 8: Update the seed with PKWT end dates**

In `src/lib/db/seed/index.ts`, for CONTRACT/PROBATION employees (e.g. Rian `b...0009`, status PROBATION), add `contract_end_date` to the INSERT column list and a date value (e.g. `'2026-12-31'`). Others stay NULL (column is nullable).

- [ ] **Step 9: Run tests + build**

Run: `npx vitest run tests/unit/coreHrService.test.ts tests/integration/govera-0006-schema.test.ts -v && npm run build`
Expected: PASS and successful build.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(pkwt): add employees.contract_end_date; compute contractDaysRemaining"
```

---

## WS-1 — Kill Hardcoded Analytics (DB-driven)

### Task 6: VMAI + pillar scores from real KPI aggregation

**Files:**
- Modify: `src/lib/repositories/analyticsRepository.ts` (`selectActivePillars`)
- Modify: `src/app/api/v1/analytics/vmai-scorecard/route.ts` + `src/lib/engines/vmai-engine.ts` (real period + employee count)
- Test: `tests/integration/analytics-vmai.test.ts` (new)

**Interfaces:**
- Produces: `selectActivePillars(db: Db, periodIdentifier?: string)` → `StrategicPillar[]` with `achievedScore = SUM(actual)/SUM(target)*100` per pillar (0 when no KPIs).
- Produces: VMAI response `total_evaluated_employees` = `COUNT(*) FROM employees WHERE status <> 'RESIGNED'`; `period_code` from resolved `appraisal_periods`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/analytics-vmai.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { selectActivePillars } from '@/lib/repositories/analyticsRepository';
import type { Db } from '@/lib/db/client';

describe('VMAI pillar scoring from real KPIs', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('menghitung achievedScore dari individual_kpis, bukan konstanta 92.4', async () => {
    const pillars = await selectActivePillars(db);
    const internal = pillars.find((p) => p.perspective === 'INTERNAL_PROCESS')!;
    expect(internal.achievedScore).toBeGreaterThan(95);
    expect(internal.achievedScore).not.toBe(92.4);
  });

  it('mengembalikan nilai finite (bukan NaN) bila tidak ada KPI', async () => {
    const pillars = await selectActivePillars(db, '9999-NONE');
    for (const p of pillars) expect(Number.isFinite(p.achievedScore)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/analytics-vmai.test.ts -v`
Expected: FAIL — `achievedScore` is `92.4`.

- [ ] **Step 3: Implement the aggregation**

Rewrite `selectActivePillars` in `src/lib/repositories/analyticsRepository.ts`:

```ts
export async function selectActivePillars(db: Db, periodIdentifier?: string): Promise<StrategicPillar[]> {
  const isUuid = !!periodIdentifier && /^[0-9a-f-]{36}$/i.test(periodIdentifier);
  const result = await db.execute(sql`
    SELECT sp.id, sp.perspective, sp.pillar_name AS "pillarName", sp.description,
           sp.strategic_weight AS "strategicWeight",
           COALESCE(
             (SELECT CASE WHEN SUM(ik.target_value) > 0
                          THEN (SUM(ik.actual_value) / SUM(ik.target_value)) * 100
                          ELSE 0 END
                FROM individual_kpis ik
               WHERE ik.strategic_pillar_id = sp.id
                 AND (${isUuid} = FALSE OR ik.period_id = ${periodIdentifier ?? null}::uuid)),
             0) AS "achievedScore",
           100 AS "targetScore"
      FROM strategic_pillars sp
     WHERE sp.is_active = TRUE
     ORDER BY sp.perspective ASC
  `);
  return result.rows.map((row: any) => ({
    id: row.id, perspective: row.perspective, pillarName: row.pillarName,
    description: row.description, strategicWeight: Number(row.strategicWeight),
    achievedScore: Number(row.achievedScore) || 0, targetScore: Number(row.targetScore),
  }));
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npx vitest run tests/integration/analytics-vmai.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Replace `totalEmployees`/`periodCode` hardcodes**

In `src/app/api/v1/analytics/vmai-scorecard/route.ts` (and `analyticsService`/`vmai-engine` caller): compute `COUNT(*)` from `employees` (excluding RESIGNED) and read the active period code from `appraisal_periods`; pass as `total_evaluated_employees` and `period_code`. Remove the `1240` / `'2026-Q3'` literals from `src/lib/engines/vmai-engine.ts`.

- [ ] **Step 6: Run tests + build**

Run: `npx vitest run tests/integration/analytics-vmai.test.ts tests/api/govera-analytics-routes.test.ts -v && npm run build`
Expected: PASS and successful build.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(analytics): compute VMAI pillar scores and totals from DB"
```

---

### Task 7: Benchmark gap + executive/lifecycle summaries from DB

**Files:**
- Create: `src/lib/db/migrations/0007_reference_data.sql` (`industry_benchmarks`, `company_vision_mission`)
- Modify: `src/lib/db/seed/index.ts` (seed both tables)
- Modify: `src/app/api/v1/analytics/benchmark-gap/route.ts` (read `industry_benchmarks` instead of inline literals)
- Create: `src/app/api/v1/analytics/executive-summary/route.ts`, `src/app/api/v1/analytics/lifecycle-summary/route.ts`
- Modify: `src/app/api/v1/performance/cascading-tree/route.ts` (vision/mission from `company_vision_mission`)
- Test: `tests/integration/analytics-summaries.test.ts` (new)

**Interfaces:**
- Produces: `GET /api/v1/analytics/benchmark-gap` → `{ metrics: Array<{ code, name, actual, benchmark, unit, variance }> }`.
- Produces: `GET /api/v1/analytics/executive-summary` → BSC quadrant scores, VMAI trend points, succession counts (all from DB).
- Produces: `GET /api/v1/analytics/lifecycle-summary` → MPP %, avg QoH, SLA %, turnover %, probation conversion.
- All routes: RBAC `assertCan(role, 'analytics:read')`, response via `ok()`, null-safe on empty DB.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/analytics-summaries.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('analytics summaries reference data', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('tabel industry_benchmarks terisi', async () => {
    const r = await client.query<{ c: string }>('SELECT count(*)::text AS c FROM industry_benchmarks');
    expect(Number(r.rows[0].c)).toBeGreaterThan(0);
  });

  it('tabel company_vision_mission terisi minimal 1 baris', async () => {
    const r = await client.query<{ c: string }>('SELECT count(*)::text AS c FROM company_vision_mission');
    expect(Number(r.rows[0].c)).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/analytics-summaries.test.ts -v`
Expected: FAIL — relation does not exist.

- [ ] **Step 3: Create migration 0007 (idempotent)**

Create `src/lib/db/migrations/0007_reference_data.sql`:

```sql
CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code VARCHAR(50) UNIQUE NOT NULL,
  metric_name VARCHAR(150) NOT NULL,
  benchmark_value DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_vision_mission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  vision TEXT NOT NULL,
  mission TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 4: Seed both tables (idempotent)**

Add INSERTs to `src/lib/db/seed/index.ts` with `ON CONFLICT DO NOTHING`. `metric_code` values matching PRD §3: `VMAI_TARGET` 85.00, `TURNOVER_MAX` 3.00, `SLA_MIN` 98.00, `QOH_MIN` 85.00, `MPP_TARGET` 95.00. One `company_vision_mission` row for the seeded company.

- [ ] **Step 5: Run the schema/seed test**

Run: `npx vitest run tests/integration/analytics-summaries.test.ts -v`
Expected: PASS.

- [ ] **Step 6: Implement the services + routes**

Add `getBenchmarkGap(db)`, `getExecutiveSummary(db)`, `getLifecycleSummary(db)` to `analyticsService.ts` (or a new `analyticsSummaryService.ts`): aggregate existing tables, join `industry_benchmarks`. Rewrite `benchmark-gap/route.ts` to call `getBenchmarkGap`. Create the two new routes as thin RBAC + `ok()` adapters. All math guarded against divide-by-zero (return 0).

- [ ] **Step 7: Write the empty-DB null-safety test**

Add a case creating an unseeded DB (`createTestDb()` with no `runSeed`) asserting the three summary functions return finite numbers / empty arrays and never throw.

- [ ] **Step 8: Run tests + build**

Run: `npx vitest run tests/integration/analytics-summaries.test.ts -v && npm run build`
Expected: PASS and successful build.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(analytics): DB-driven benchmark gap + executive/lifecycle summaries"
```

---

## WS-2 — Kill Hardcoded UI (data from API)

### Task 8: Wire UI metric cards/charts to APIs; add supporting routes

**Files:**
- Create: `src/app/api/v1/performance/team-roster/route.ts`, `src/app/api/v1/performance/my-scorecard/route.ts`, `src/app/api/v1/performance/nine-box-summary/route.ts`
- Modify: `src/app/dashboard/executive/page.tsx`, `src/app/dashboard/hr-command/page.tsx`, `src/app/dashboard/manager-cockpit/page.tsx`, `src/app/dashboard/employee-portal/page.tsx`, `src/app/dashboard/ninebox-matrix/page.tsx`
- Modify: `src/components/charts/RadarChartBSC.tsx`, `src/components/charts/GaussianCurve.tsx` (accept `data` props)
- Test: `tests/api/ui-data-routes.test.ts` (new)

**Interfaces:**
- Consumes: `scope.ts` (`resolveScopeForRole`, `assertEmployeeVisible`), `appraisalRepository`, `kpiRepository`, `getAuthSession`, `assertCan`.
- Produces: `GET /performance/my-scorecard` → `{ kpiCompositeScore, sopComplianceScore, competencyScore, coreValuesScore, totalPercentageScore, compositeGpa, performanceRating, nineBoxQuadrant }` for the session employee; 403 for other ids.
- Produces: `GET /performance/team-roster` → array of in-scope subordinates with latest appraisal summary.
- Produces: `GET /performance/nine-box-summary` → `{ total, byQuadrant: Record<quadrant, number> }`.

- [ ] **Step 1: Write the failing route tests**

Create `tests/api/ui-data-routes.test.ts`: `my-scorecard` 401 without cookie; 200 with EMPLOYEE cookie returning their appraisal; 403 when an EMPLOYEE requests another id; `nine-box-summary` counts sum to total and returns 0 on an empty DB.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/api/ui-data-routes.test.ts -v`
Expected: FAIL — routes return 404.

- [ ] **Step 3: Implement the three routes**

Each: `getAuthSession` → `assertCan` → scope check via `scope.ts` → Drizzle query via repos → `ok(...)`. Null-safe on empty data.

- [ ] **Step 4: Verify route tests pass**

Run: `npx vitest run tests/api/ui-data-routes.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Rewire the six dashboard pages + two charts**

Replace literal metric values and local `useState` arrays with `fetch()` to the endpoints (mirror the existing fetch pattern in each page). Convert `RadarChartBSC`/`GaussianCurve` to accept `data` props; update callers to pass API data. In `ninebox-matrix`, remove the fake `setTimeout` "Simulasi Talent Pool" (replace with a clear no-op label or a real action). Leave `audit-governance`'s `tarifPrinciples` static (conceptual) but move its numeric metrics to API — note the decision in the ADR (Task 13).

- [ ] **Step 6: Build + smoke check**

Run: `npm run build`
Expected: successful build (types for new props/routes resolve).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): drive dashboard metrics/charts from DB-backed APIs"
```

---

## WS-3 — Governance Chatbot (functional, non-LLM)

### Task 9: Replace keyword-only chatbot with a DB-backed, scoped engine

**Files:**
- Create: `src/lib/db/migrations/0008_policy_knowledge_base.sql`
- Modify: `src/lib/db/seed/index.ts` (seed policy Q&A)
- Modify: `src/lib/services/helpdeskChatbotService.ts` (`queryPolicyChatbotEngine`)
- Modify: `src/app/api/v1/governance/chatbot/route.ts` (require auth + scope; pass session employee)
- Modify: `tests/unit/helpdeskChatbotService.test.ts` (strengthen)
- Test: `tests/integration/chatbot-service.test.ts` (new)

**Interfaces:**
- Consumes: `getAuthSession`, `assertCan`, `scope.ts`.
- Produces: `queryPolicyChatbotEngine(db: Db, question: string, employeeId: string)` → `Promise<{ answer: string; source: 'POLICY' | 'DATA' | 'FALLBACK'; confidence: number }>`.
  - POLICY: best keyword match in `policy_knowledge_base`.
  - DATA: real answers for the caller (e.g. leave balance from `leave_requests`, latest expense-claim status from `expense_claims`, severance date from `severance_calculations`).
  - FALLBACK: when nothing matches.

- [ ] **Step 1: Define the contract with a failing test**

Add to `tests/integration/chatbot-service.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { queryPolicyChatbotEngine } from '@/lib/services/helpdeskChatbotService';
import type { Db } from '@/lib/db/client';

describe('governance chatbot engine', () => {
  let client: PGlite; let db: Db;
  const BUDI = 'b0000000-0000-4000-8000-000000000004';
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('menjawab pertanyaan kebijakan dari knowledge base (bukan substring statis)', async () => {
    const res = await queryPolicyChatbotEngine(db, 'bagaimana prosedur pengajuan cuti?', BUDI);
    expect(res.source).toBe('POLICY');
    expect(res.confidence).toBeGreaterThan(0);
  });

  it('mengembalikan FALLBACK untuk pertanyaan di luar topik', async () => {
    const res = await queryPolicyChatbotEngine(db, 'harga saham hari ini berapa?', BUDI);
    expect(res.source).toBe('FALLBACK');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/chatbot-service.test.ts -v`
Expected: FAIL — signature/return shape mismatch.

- [ ] **Step 3: Create migration 0008 (idempotent)**

Create `src/lib/db/migrations/0008_policy_knowledge_base.sql`:

```sql
CREATE TABLE IF NOT EXISTS policy_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT NOT NULL,
  category VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 4: Seed policy Q&A (idempotent)**

Add ≥6 rows to `src/lib/db/seed/index.ts` covering leave, reimbursement, payslip PIN, severance (PP 35/2021), timesheet, KPI evidence — each with comma-separated `keywords`.

- [ ] **Step 5: Implement the engine**

Rewrite `queryPolicyChatbotEngine(db, question, employeeId)`:
1. Tokenize the question; score each `policy_knowledge_base` row by keyword overlap; if best score ≥ threshold → `source: 'POLICY'`, `confidence` = normalized score.
2. Else, detect data-intent keywords (cuti/saldo, klaim/reimburse, pesangon) → query the relevant table **for `employeeId` only** → `source: 'DATA'`.
3. Else → helpful `FALLBACK` text.

- [ ] **Step 6: Update the route to authenticate + scope**

In `src/app/api/v1/governance/chatbot/route.ts`: `getAuthSession` (401 if none) → derive `employeeId` from session (do NOT trust body) → call the engine → `ok()`. Reject if the session has no employee mapping.

- [ ] **Step 7: Strengthen the old unit test + verify all pass**

Rewrite `tests/unit/helpdeskChatbotService.test.ts` to assert `source`/`confidence` behavior with a mocked DB (no substring-only assertions).

Run: `npx vitest run tests/integration/chatbot-service.test.ts tests/unit/helpdeskChatbotService.test.ts -v && npm run build`
Expected: PASS and successful build.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(chatbot): DB-backed, scoped governance chatbot (non-LLM)"
```

---

## WS-4 — Server-side Role Gating

### Task 10: Enforce role gating at the edge and on the client

**Files:**
- Modify: `src/middleware.ts` (verify JWT with `verifySession`; redirect by role)
- Create: `src/lib/auth/requireRole.ts` (server helper)
- Modify: `src/app/dashboard/layout.tsx` or per-route layouts (apply `requireRole`)
- Modify: `src/lib/context/AuthContext.tsx` (remove demo defaults: `activeRole='BOD'`, `isAuthenticated=true`)
- Test: `tests/unit/middleware.test.ts` (new), `tests/unit/requireRole.test.ts` (new)

**Interfaces:**
- Consumes: `verifySession(token)` from `src/lib/auth/session.ts`; `SESSION_COOKIE_NAME`; `UserRole`.
- Produces: `requireRole(role: UserRole, allowed: UserRole[]): void` throwing `ForbiddenError` when not allowed; middleware that (a) allows `/login` only when unauthenticated, (b) requires a valid JWT for `/dashboard/*`, (c) redirects a role to a permitted route when hitting a forbidden one.

- [ ] **Step 1: Write failing unit tests**

`requireRole` test: allowed role passes; disallowed throws. Middleware test: missing cookie → redirect to `/login`; tampered JWT (`invalid.token.here`) → redirect to `/login`; valid JWT for `EMPLOYEE` hitting `/dashboard/executive` → redirect to `/dashboard/employee-portal`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/requireRole.test.ts tests/unit/middleware.test.ts -v`
Expected: FAIL — helpers/routes not implemented.

- [ ] **Step 3: Implement `requireRole`**

```ts
// src/lib/auth/requireRole.ts
import { ForbiddenError } from '@/lib/api/errors';
import type { UserRole } from '@/types';

export function requireRole(role: UserRole, allowed: readonly UserRole[]): void {
  if (!allowed.includes(role)) {
    throw new ForbiddenError('Role tidak berhak mengakses halaman ini.');
  }
}
```

- [ ] **Step 4: Implement middleware JWT verification + role redirect**

Rewrite `src/middleware.ts`: read `SESSION_COOKIE_NAME` cookie; if missing → redirect `/login`. If present, `await verifySession(token)`; if null → clear cookie + redirect `/login`. For `/dashboard/<segment>`, map segment → allowed roles (reuse the Sidebar role map) and redirect a disallowed role to its first allowed dashboard. Keep `/login` → redirect to `/dashboard/executive` only when the JWT is valid.

- [ ] **Step 5: Apply `requireRole` in dashboard layouts**

In `src/app/dashboard/<segment>/layout.tsx` (create per-segment layouts if absent), resolve the session server-side, then call `requireRole(role, [...])`. Reuse the exact role lists from `Sidebar.tsx`.

- [ ] **Step 6: Remove client demo defaults**

In `src/lib/context/AuthContext.tsx`: start from `{ currentUser: null, activeRole: null, isAuthenticated: false, isLoading: true }`; set state only after `/auth/me` resolves. Remove the `DEMO_LOGIN_ACCOUNTS[0]` default user.

- [ ] **Step 7: Run tests + build**

Run: `npx vitest run tests/unit/requireRole.test.ts tests/unit/middleware.test.ts -v && npm run build`
Expected: PASS and successful build.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth): server-side JWT verification and role gating; drop demo client defaults"
```

---

## WS-8 — Dual-Driver Database (PGlite default + PostgreSQL server)

### Task 11: Add a driver seam and dual-mode migration/seed support

**Files:**
- Modify: `src/lib/db/client.ts` (choose driver from env; export a `SqlClient` interface)
- Modify: `src/lib/db/migrate.ts`, `src/lib/db/seed/index.ts` (accept `SqlClient` instead of `PGlite`)
- Modify: `tests/setup.ts` (keep PGlite; export a `createTestSqlClient()` alias)
- Modify: `package.json` (add `postgres` dependency)
- Test: `tests/integration/dual-driver.test.ts` (new)

**Interfaces:**
- Produces: `export interface SqlClient { query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>; exec(sql: string): Promise<unknown>; }` from `src/lib/db/client.ts`.
- Produces: `runMigrations(client: SqlClient)`, `runSeed(client: SqlClient)`.
- Produces: `db`/`getDb()` unchanged in shape; `db` uses postgres-js when `DATABASE_URL` is set, else PGlite.

- [ ] **Step 1: Write the failing dual-mode test**

Create `tests/integration/dual-driver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed } from '@/lib/db/seed';

const HAS_PG = !!process.env.DATABASE_URL;

describe('dual-driver', () => {
  it('PGlite: migrasi + seed berjalan pada klien in-memory', async () => {
    const client = new PGlite();
    await runMigrations(client as any);
    await runSeed(client as any);
    const r = await client.query<{ c: string }>('SELECT count(*)::text AS c FROM users');
    expect(Number(r.rows[0].c)).toBeGreaterThan(0);
    await client.close();
  });

  it.skipIf(!HAS_PG)('PostgreSQL server: migrasi + seed berjalan pada DATABASE_URL', async () => {
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.DATABASE_URL!);
    const client = {
      query: async (q: string, p?: any[]) => ({ rows: await sql.unsafe(q, p ?? []) }),
      exec: async (q: string) => { await sql.unsafe(q); },
    };
    await runMigrations(client as any);
    await runSeed(client as any);
    const rows = await sql.unsafe('SELECT count(*)::text AS c FROM users');
    expect(Number((rows as any)[0].c)).toBeGreaterThan(0);
    await sql.end();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/integration/dual-driver.test.ts -v`
Expected: FAIL — `runMigrations`/`runSeed` typed to `PGlite`, `postgres` not installed.

- [ ] **Step 3: Install `postgres`**

Run: `npm install postgres@^3.4.5`
Expected: dependency added to `package.json`.

- [ ] **Step 4: Introduce `SqlClient` and adapt `client.ts`**

Add the `SqlClient` interface; in `createDb()`, if `process.env.DATABASE_URL` is set, use `postgres(DATABASE_URL)` wrapped by `drizzle-orm/postgres-js`; else keep PGlite. Make `getDb()` return an object satisfying `SqlClient` (PGlite raw client or a thin adapter over the postgres-js client exposing `query`/`exec`). Keep the singleton pattern.

- [ ] **Step 5: Retype `runMigrations` and `runSeed` to `SqlClient`**

Change the parameter type from `PGlite` to `SqlClient`; replace any PGlite-specific calls with `.query()`/`.exec()` that both drivers satisfy. Keep the `__migrations` tracking logic.

- [ ] **Step 6: Run the dual-mode test (PGlite branch) + full suite**

Run: `npx vitest run tests/integration/dual-driver.test.ts -v && npx vitest run --reporter=basic`
Expected: PGlite case PASS; Postgres case skipped when `DATABASE_URL` unset; whole suite green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): dual-driver seam (PGlite default + postgres-js via DATABASE_URL)"
```

---

## WS-7 — Verification, Docs & ADRs

### Task 12: Full green run, smoke test, ADRs, README

**Files:**
- Create: `docs/decisions/005-reference-data-and-benchmarks.md`, `docs/decisions/006-chatbot-non-llm.md`, `docs/decisions/007-dual-driver-database.md`
- Modify: `README.md` (create if absent): run instructions for PGlite mode and Postgres mode
- Verify: whole app

**Interfaces:**
- Consumes: everything above.
- Produces: a green suite, a successful build, documented decisions and run steps.

- [ ] **Step 1: Run the full verification**

Run: `npx vitest run --reporter=basic && npm run build`
Expected: 0 failed test files; build succeeds.

- [ ] **Step 2: Reset and reseed the dev DB end-to-end**

Run: `npm run db:reset`
Expected: migrate + seed succeed with no errors.

- [ ] **Step 3: Smoke test in the browser**

Start dev server (`npm run dev`), log in as each role via `DEMO_LOGIN_ACCOUNTS`, and confirm: 6 dashboards load with DB-driven numbers (no 500s), 8 employee modals work, chatbot responds with POLICY/DATA/FALLBACK, and a disallowed dashboard redirects.

- [ ] **Step 4: Write the ADRs**

- `005`: benchmark + vision/mission stored as seeded reference tables (why: changeable without code).
- `006`: chatbot is deterministic/DB-backed, not LLM/RAG (why: no external model, scope-safe); LLM deferred (M-11).
- `007`: dual-driver DB — PGlite default, Postgres via `DATABASE_URL`; tradeoffs (single-process vs HA).

- [ ] **Step 5: Update `README.md`**

Document: prerequisites, `npm install`, `npm run db:reset`, `npm run dev`; env vars `PGLITE_DATA_DIR`, `DATABASE_URL`, `JWT_SECRET`; test/build commands; note that PGlite is single-process and Postgres mode enables HA/concurrency.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "docs: ADRs 005-007 and README for production-ready run"
```

---

## Spec Coverage Check

| Spec workstream | Plan task(s) |
|---|---|
| WS-0 seed blocker + tests | Task 1, Task 2 |
| WS-5 cleanup (.bak, dummy-data) | Task 3, Task 4 |
| WS-6 PKWT column | Task 5 |
| WS-1 analytics DB-driven | Task 6, Task 7 |
| WS-2 UI DB-driven | Task 8 |
| WS-3 chatbot | Task 9 |
| WS-4 server gating | Task 10 |
| WS-8 dual-driver | Task 11 |
| WS-7 verification/docs | Task 12 |

## Execution Handoff

Two execution options:

- **Subagent-driven (recommended for this plan):** each of the 12 tasks is implemented by a fresh subagent and independently reviewed before the next starts. Recommended because tasks are tightly coupled to interface contracts (e.g. Task 8 consumes Task 7's routes; Task 11 changes shared DB types) and a shipped mistake in the seed or DB seam is expensive.
- **Native:** execute all tasks in one session, then one whole-branch review.

Per the writing-plans skill: review this plan, confirm it captures the intent, then choose the execution method. On approval, implementation proceeds via the chosen skill (`subagent-driven-development` or `executing-plans`), starting with Task 1.
