# PRD v2.0 Phase 1 — Daily Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Revisi 2 points 1, 2, 8, and 9 real: employment status, daily KPI entry per indicator, the Daily Performance Index traffic light, daily/monthly/yearly recap, supervisor verification, and the employee Daily Cockpit.

**Architecture:** Four additive PostgreSQL migrations on top of the 37 that already exist, a pure DPI engine (`src/lib/engines/dpiEngine.ts`), four services that take a `Db` and use Drizzle `sql` templates, thin App Router routes that follow the existing `getAuthSession` → `assertCan` → `ok/fail` contract, and client components mounted into the existing `employee-portal` and `manager-cockpit` pages. Daily entries roll up into the existing `individual_kpis.actual_value`, so GPA, VMAI, and the 9-Box keep their v1.0.0 formulas unchanged.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Drizzle ORM over PGlite (local/test) and postgres-js (production), PostgreSQL 15, Zod, Vitest, Tailwind, lucide-react.

**Spec:** `PRD_Sistem_Penilaian_Karyawan (PT).md` — §4.3, §5.5, §6.2, §8, §10.3 (A–D, G, H), §11.5.

## Global Constraints

- Every migration is a new file in `src/lib/db/migrations/`, numbered sequentially after `0037_notification_recipients.sql`; never edit an applied migration.
- New services take `db: Db` as their first parameter (pattern: `src/lib/services/attendanceLogService.ts`). Never call `getDb()` inside a service that must be testable.
- Every route validates input with Zod, reads the session with `getAuthSession(req)`, guards with `assertCan(session, permission)`, and responds with `ok()` / `fail()` from `@/lib/api/response`.
- Any new permission must be added to the `Permission` union and `MATRIX` in `src/lib/auth/rbac.ts`; a route may not hardcode a role list.
- Timestamps are stored with `TIMESTAMPTZ`; calendar days are `DATE`. "Today" is computed in the company timezone (`Asia/Jakarta`), never from `toISOString()` alone.
- Data classified `RESTRICTED` by PRD §6.2 (salary, payroll, BPJS numbers, medical, private chat) must never enter `activity_events`, the DPI context, or an AI prompt.
- The traffic light is never the only signal in the UI: every colour is paired with a text label (PRD §7.5, accessibility).
- Tests run with `npx vitest run <file>`; a task is not done until its named test file passes.

## Review Focus

- **A brand-new employee with no indicators yet.** `computeDpi([])` must return `NO_DATA`, not `0` or `NaN`, and the cockpit must show "belum ada indikator" instead of a red box.
- **`LOWER_BETTER` indicator with an actual of `0`** (e.g. zero defects). The ratio must cap at `1.2`, never divide by zero or produce `Infinity`.
- **An indicator whose target was edited after entries exist.** The stored snapshot must keep the score it was computed with; a later target change must not retroactively rewrite history.
- **A day where the employee submitted only some indicators.** `filled` vs `expected` must both be reported, and the DPI must use only measured weights — not treat missing entries as zero.
- **Two supervisors verifying the same entry concurrently.** The second decision must fail with a business error rather than silently overwrite the first, and the receipt must name the winner.

---

### Task 1: Employment status schema and history

**Files:**
- Create: `src/lib/db/migrations/0038_employment_status.sql`
- Test: `tests/integration/prd-v2-employment-status.test.ts`

**Interfaces:**
- Produces: table `employment_status_history(id, employee_id, previous_status, new_status, effective_date, reason, decided_by, created_at)`; columns `employees.employment_status`, `employees.appointment_date`; enum `employment_status_enum`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('PRD v2 — status kepegawaian', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('employees punya employment_status default PROBATION', async () => {
    const res = await db.execute(`SELECT employment_status FROM employees WHERE id = '${BUDI}'`);
    expect(res.rows[0].employment_status).toBe('PROBATION');
  });

  it('riwayat menolak perubahan ke status yang sama', async () => {
    await expect(
      db.execute(`INSERT INTO employment_status_history
        (employee_id, previous_status, new_status, effective_date)
        VALUES ('${BUDI}', 'PROBATION', 'PROBATION', CURRENT_DATE)`)
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/prd-v2-employment-status.test.ts`
Expected: FAIL — `column "employment_status" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- 0038: Status kepegawaian + riwayat (PRD v2.0 §10.3 A).
-- Aditif: kolom baru punya default sehingga data berjalan tetap valid.
CREATE TYPE employment_status_enum AS ENUM
  ('PROBATION', 'PKWT', 'PKWTT', 'TETAP', 'RESIGNED', 'RETIRED');

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employment_status employment_status_enum NOT NULL DEFAULT 'PROBATION',
  ADD COLUMN IF NOT EXISTS appointment_date DATE;

CREATE TABLE IF NOT EXISTS employment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  previous_status employment_status_enum,
  new_status employment_status_enum NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (previous_status IS DISTINCT FROM new_status)
);

CREATE INDEX IF NOT EXISTS idx_employment_history_employee
  ON employment_status_history (employee_id, effective_date DESC);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/prd-v2-employment-status.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/migrations/0038_employment_status.sql tests/integration/prd-v2-employment-status.test.ts
git commit -m "feat(db): status kepegawaian + riwayat (PRD v2 fase 1)"
```

---

### Task 2: Activity event log (feed foundation)

**Files:**
- Create: `src/lib/db/migrations/0039_activity_events.sql`
- Create: `src/lib/services/activityFeedService.ts`
- Test: `tests/integration/activity-feed.test.ts`

**Interfaces:**
- Produces:
  - `appendActivity(db: Db, input: { employeeId: string; eventType: ActivityEventType; entityId?: string | null; summary: string; visibility?: ActivityVisibility; occurredAt?: string }): Promise<void>`
  - `listActivity(db: Db, employeeId: string, limit?: number): Promise<ActivityRow[]>`
  - types `ActivityEventType`, `ActivityVisibility`, `ActivityRow`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { appendActivity, listActivity } from '@/lib/services/activityFeedService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('activity feed', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('menyimpan dan membaca kembali kejadian', async () => {
    await appendActivity(db, { employeeId: BUDI, eventType: 'KPI_DAILY', summary: 'Mengisi 3 indikator' });
    const rows = await listActivity(db, BUDI, 10);
    expect(rows[0].summary).toBe('Mengisi 3 indikator');
    expect(rows[0].eventType).toBe('KPI_DAILY');
  });

  it('menolak visibilitas RESTRICTED pada feed', async () => {
    await expect(
      appendActivity(db, { employeeId: BUDI, eventType: 'KPI_DAILY', summary: 'gaji', visibility: 'RESTRICTED' })
    ).rejects.toThrow(/RESTRICTED/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/activity-feed.test.ts`
Expected: FAIL — cannot resolve `@/lib/services/activityFeedService`.

- [ ] **Step 3: Write the migration**

```sql
-- 0039: Feed aktivitas terpadu (PRD v2.0 §5.11, §10.3 F).
CREATE TYPE activity_event_type_enum AS ENUM
  ('ATTENDANCE', 'KPI_DAILY', 'DPI_STATUS', 'LEAVE', 'OVERTIME',
   'TRAINING', 'LETTER', 'DISCIPLINARY', 'RECOGNITION', 'CAREER');

CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type activity_event_type_enum NOT NULL,
  entity_id UUID,
  summary VARCHAR(255) NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'
    CHECK (visibility IN ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_feed
  ON activity_events (employee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_visibility
  ON activity_events (visibility, occurred_at DESC);
```

- [ ] **Step 4: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export type ActivityEventType =
  | 'ATTENDANCE' | 'KPI_DAILY' | 'DPI_STATUS' | 'LEAVE' | 'OVERTIME'
  | 'TRAINING' | 'LETTER' | 'DISCIPLINARY' | 'RECOGNITION' | 'CAREER';

export type ActivityVisibility = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface ActivityRow {
  id: string;
  employeeId: string;
  eventType: ActivityEventType;
  entityId: string | null;
  summary: string;
  visibility: ActivityVisibility;
  occurredAt: string;
}

export async function appendActivity(
  db: Db,
  input: {
    employeeId: string;
    eventType: ActivityEventType;
    entityId?: string | null;
    summary: string;
    visibility?: ActivityVisibility;
    occurredAt?: string;
  },
): Promise<void> {
  const visibility = input.visibility ?? 'INTERNAL';
  if (visibility === 'RESTRICTED') {
    throw new BusinessRuleError(
      'Kejadian RESTRICTED (gaji, BPJS, data medis, chat pribadi) tidak boleh masuk activity feed.',
    );
  }

  await db.execute(sql`
    INSERT INTO activity_events (employee_id, event_type, entity_id, summary, visibility, occurred_at)
    VALUES (${input.employeeId}::uuid, ${input.eventType}::activity_event_type_enum,
            ${input.entityId ?? null}::uuid, ${input.summary}, ${visibility},
            COALESCE(${input.occurredAt ?? null}::timestamptz, CURRENT_TIMESTAMP))
  `);
}

export async function listActivity(db: Db, employeeId: string, limit = 50): Promise<ActivityRow[]> {
  const res = (await db.execute(sql`
    SELECT id, employee_id AS "employeeId", event_type AS "eventType",
           entity_id AS "entityId", summary, visibility, occurred_at AS "occurredAt"
      FROM activity_events
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY occurred_at DESC
     LIMIT ${limit}
  `)) as unknown as { rows: ActivityRow[] };
  return res.rows ?? [];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/activity-feed.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/migrations/0039_activity_events.sql src/lib/services/activityFeedService.ts tests/integration/activity-feed.test.ts
git commit -m "feat(feed): activity events + writer (PRD v2 fase 1)"
```

---

### Task 3: KPI indicators and daily entries

**Files:**
- Create: `src/lib/db/migrations/0040_kpi_daily_entries.sql`
- Test: `tests/integration/prd-v2-daily-kpi-schema.test.ts`

**Interfaces:**
- Produces: `kpi_indicators`, `kpi_daily_entries`, enums `kpi_direction_enum`, `kpi_frequency_enum`, `kpi_aggregation_enum`, `daily_entry_status_enum`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('PRD v2 — skema KPI harian', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('satu entri per indikator per hari', async () => {
    const kpi = await db.execute(`
      SELECT k.id FROM individual_kpis k LIMIT 1`);
    expect(kpi.rows.length).toBe(1);
    const kpiId = kpi.rows[0].id;

    const ind = await db.execute(`
      INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value)
      VALUES ('${kpiId}', 'Tiket selesai', 10) RETURNING id`);
    const indId = ind.rows[0].id;

    const emp = await db.execute(`SELECT employee_id FROM individual_kpis WHERE id = '${kpiId}'`);
    const employeeId = emp.rows[0].employee_id;

    await db.execute(`
      INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value)
      VALUES ('${indId}', '${employeeId}', '2026-10-21', 8)`);

    await expect(db.execute(`
      INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value)
      VALUES ('${indId}', '${employeeId}', '2026-10-21', 9)`)
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/prd-v2-daily-kpi-schema.test.ts`
Expected: FAIL — relation `kpi_indicators` does not exist.

- [ ] **Step 3: Write the migration**

```sql
-- 0040: Indikator & entri KPI harian (PRD v2.0 §10.3 B).
CREATE TYPE kpi_direction_enum AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');
CREATE TYPE kpi_frequency_enum AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE kpi_aggregation_enum AS ENUM ('SUM', 'AVG', 'LAST', 'MAX');
CREATE TYPE daily_entry_status_enum AS ENUM
  ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED');

CREATE TABLE IF NOT EXISTS kpi_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES individual_kpis(id) ON DELETE CASCADE,
  indicator_name VARCHAR(200) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT '%',
  target_value DECIMAL(12,2) NOT NULL CHECK (target_value > 0),
  direction kpi_direction_enum NOT NULL DEFAULT 'HIGHER_BETTER',
  frequency kpi_frequency_enum NOT NULL DEFAULT 'DAILY',
  aggregation kpi_aggregation_enum NOT NULL DEFAULT 'AVG',
  indicator_weight DECIMAL(5,2) NOT NULL DEFAULT 100
    CHECK (indicator_weight > 0 AND indicator_weight <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (kpi_id, indicator_name)
);

CREATE TABLE IF NOT EXISTS kpi_daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES kpi_indicators(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  actual_value DECIMAL(12,2) NOT NULL CHECK (actual_value >= 0),
  note TEXT,
  evidence_url TEXT,
  status daily_entry_status_enum NOT NULL DEFAULT 'DRAFT',
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (indicator_id, employee_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_daily_employee_date
  ON kpi_daily_entries (employee_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_daily_pending
  ON kpi_daily_entries (status, entry_date) WHERE status = 'SUBMITTED';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/prd-v2-daily-kpi-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/migrations/0040_kpi_daily_entries.sql tests/integration/prd-v2-daily-kpi-schema.test.ts
git commit -m "feat(db): indikator & entri KPI harian (PRD v2 fase 1)"
```

---

### Task 4: DPI settings, snapshots, and the recap view

**Files:**
- Create: `src/lib/db/migrations/0041_daily_performance.sql`
- Test: `tests/integration/prd-v2-dpi-schema.test.ts`

**Interfaces:**
- Produces: `company_dpi_settings`, `daily_performance_snapshots`, enum `traffic_light_enum`, view `v_employee_daily_recap`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('PRD v2 — DPI & snapshot', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('view rekap mengagregasi snapshot per bulan', async () => {
    await db.execute(`
      INSERT INTO daily_performance_snapshots
        (employee_id, snapshot_date, dpi_score, traffic_light, indicators_expected, indicators_filled)
      VALUES ('${BUDI}', '2026-10-20', 95.00, 'GREEN', 3, 3),
             ('${BUDI}', '2026-10-21', 64.00, 'RED', 3, 2)`);

    const res = await db.execute(`
      SELECT days_green, days_red, avg_dpi, entry_adherence
        FROM v_employee_daily_recap
       WHERE employee_id = '${BUDI}' AND period_month = '2026-10-01'`);
    expect(Number(res.rows[0].days_green)).toBe(1);
    expect(Number(res.rows[0].days_red)).toBe(1);
    expect(Number(res.rows[0].avg_dpi)).toBeCloseTo(79.5, 1);
  });

  it('menolak DPI di luar 0..120', async () => {
    await expect(db.execute(`
      INSERT INTO daily_performance_snapshots (employee_id, snapshot_date, dpi_score)
      VALUES ('${BUDI}', '2026-10-22', 150)`)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/prd-v2-dpi-schema.test.ts`
Expected: FAIL — relation `daily_performance_snapshots` does not exist.

- [ ] **Step 3: Write the migration**

```sql
-- 0041: Ambang DPI, snapshot harian, dan view rekap (PRD v2.0 §10.3 C, G).
CREATE TYPE traffic_light_enum AS ENUM ('GREEN', 'YELLOW', 'RED', 'NO_DATA');

CREATE TABLE IF NOT EXISTS company_dpi_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  green_threshold DECIMAL(5,2) NOT NULL DEFAULT 90.00,
  yellow_threshold DECIMAL(5,2) NOT NULL DEFAULT 70.00,
  achievement_cap DECIMAL(5,2) NOT NULL DEFAULT 1.20,
  absence_demotes BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (green_threshold > yellow_threshold)
);

CREATE TABLE IF NOT EXISTS daily_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  dpi_score DECIMAL(6,2),
  traffic_light traffic_light_enum NOT NULL DEFAULT 'NO_DATA',
  indicators_expected SMALLINT NOT NULL DEFAULT 0,
  indicators_filled SMALLINT NOT NULL DEFAULT 0,
  demotion_reason VARCHAR(60),
  computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, snapshot_date),
  CHECK (dpi_score IS NULL OR dpi_score BETWEEN 0 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_dpi_snapshot_date
  ON daily_performance_snapshots (snapshot_date, traffic_light);

CREATE OR REPLACE VIEW v_employee_daily_recap AS
SELECT
  s.employee_id,
  date_trunc('month', s.snapshot_date)::date AS period_month,
  count(*) FILTER (WHERE s.traffic_light = 'GREEN')   AS days_green,
  count(*) FILTER (WHERE s.traffic_light = 'YELLOW')  AS days_yellow,
  count(*) FILTER (WHERE s.traffic_light = 'RED')     AS days_red,
  count(*) FILTER (WHERE s.traffic_light = 'NO_DATA') AS days_no_data,
  round(avg(s.dpi_score) FILTER (WHERE s.dpi_score IS NOT NULL), 2) AS avg_dpi,
  sum(s.indicators_filled)::numeric
    / NULLIF(sum(s.indicators_expected), 0) AS entry_adherence
FROM daily_performance_snapshots s
GROUP BY s.employee_id, date_trunc('month', s.snapshot_date);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/prd-v2-dpi-schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/migrations/0041_daily_performance.sql tests/integration/prd-v2-dpi-schema.test.ts
git commit -m "feat(db): pengaturan DPI, snapshot harian, view rekap (PRD v2 fase 1)"
```

---

### Task 5: DPI engine (pure functions)

**Files:**
- Create: `src/lib/engines/dpiEngine.ts`
- Test: `tests/unit/dpiEngine.test.ts`

**Interfaces:**
- Produces:
  - `achievementRatio(ind: DpiIndicator): number | null`
  - `computeDpi(indicators: DpiIndicator[], cap?: number): DpiResult`
  - `classifyDpi(score: number | null, green?: number, yellow?: number): TrafficLight`
  - `applyAttendance(status: TrafficLight, attendance: AttendanceSignal, demote?: boolean): TrafficLight`
  - types `DpiIndicator`, `DpiResult`, `TrafficLight`, `AttendanceSignal`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { achievementRatio, computeDpi, classifyDpi, applyAttendance } from '@/lib/engines/dpiEngine';

const ind = (over: Partial<Parameters<typeof achievementRatio>[0]> = {}) => ({
  id: 'i1', weight: 100, target: 10, actual: 8, direction: 'HIGHER_BETTER' as const, ...over,
});

describe('dpiEngine', () => {
  it('HIGHER_BETTER: 8 dari target 10 = 0.8', () => {
    expect(achievementRatio(ind())).toBeCloseTo(0.8, 4);
  });

  it('LOWER_BETTER: actual 0 tidak pernah Infinity', () => {
    const r = achievementRatio(ind({ direction: 'LOWER_BETTER', actual: 0, target: 2 }));
    expect(Number.isFinite(r!)).toBe(true);
    expect(r!).toBeGreaterThan(1);
  });

  it('tanpa entri sama sekali → NO_DATA, bukan 0', () => {
    const res = computeDpi([]);
    expect(res.score).toBeNull();
    expect(classifyDpi(res.score)).toBe('NO_DATA');
  });

  it('hanya menghitung indikator yang terisi, bobot ternormalisasi', () => {
    const res = computeDpi([
      ind({ id: 'a', weight: 50, actual: 10 }),
      ind({ id: 'b', weight: 50, actual: null }),
    ]);
    expect(res.score).toBeCloseTo(100, 2);
    expect(res.filled).toBe(1);
    expect(res.expected).toBe(2);
  });

  it('cap 1.2 mencegah satu indikator menutupi yang lain', () => {
    const res = computeDpi([
      ind({ id: 'a', weight: 50, actual: 100 }),
      ind({ id: 'b', weight: 50, actual: 1 }),
    ]);
    expect(res.score).toBeCloseTo(60, 2); // (1.2 + 0.1) / 2 * 100
  });

  it('ambang 90/70', () => {
    expect(classifyDpi(90)).toBe('GREEN');
    expect(classifyDpi(89.99)).toBe('YELLOW');
    expect(classifyDpi(70)).toBe('YELLOW');
    expect(classifyDpi(69.99)).toBe('RED');
  });

  it('alpa menurunkan satu tingkat, tidak pernah menaikkan', () => {
    expect(applyAttendance('GREEN', 'ABSENT')).toBe('YELLOW');
    expect(applyAttendance('YELLOW', 'ABSENT')).toBe('RED');
    expect(applyAttendance('RED', 'ABSENT')).toBe('RED');
    expect(applyAttendance('NO_DATA', 'ABSENT')).toBe('NO_DATA');
    expect(applyAttendance('GREEN', 'ABSENT', false)).toBe('GREEN');
    expect(applyAttendance('GREEN', 'LATE')).toBe('GREEN');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/dpiEngine.test.ts`
Expected: FAIL — cannot resolve `@/lib/engines/dpiEngine`.

- [ ] **Step 3: Write the engine**

```ts
/**
 * Daily Performance Index — PRD v2.0 §4.3.
 * Fungsi murni: tanpa I/O, tanpa database, agar setiap aturan dapat diuji
 * langsung dan dipakai ulang oleh snapshot harian maupun rekap.
 */
export type TrafficLight = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';
export type Direction = 'HIGHER_BETTER' | 'LOWER_BETTER';
export type AttendanceSignal = 'PRESENT' | 'LATE' | 'ABSENT';

export interface DpiIndicator {
  id: string;
  weight: number;
  target: number;
  actual: number | null;
  direction: Direction;
}

export interface DpiResult {
  score: number | null;
  filled: number;
  expected: number;
  weakest: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rasio capaian; null berarti indikator belum diukur (bukan nol). */
export function achievementRatio(ind: DpiIndicator): number | null {
  if (ind.actual === null || ind.actual === undefined) return null;
  if (!Number.isFinite(ind.actual) || !Number.isFinite(ind.target)) return null;
  if (ind.target <= 0 || ind.weight <= 0) return null;
  if (ind.direction === 'HIGHER_BETTER') return ind.actual / ind.target;
  // LOWER_BETTER: actual 0 adalah hasil terbaik; 0.01 menjaga pembagi tetap
  // hingga rasio besar lalu dipotong oleh cap.
  return ind.target / Math.max(ind.actual, 0.01);
}

export function computeDpi(indicators: DpiIndicator[], cap = 1.2): DpiResult {
  const countable = indicators.filter((i) => i.weight > 0);
  const expected = countable.length;

  let weighted = 0;
  let weightSum = 0;
  let filled = 0;
  let weakest: string | null = null;
  let weakestRatio = Infinity;

  for (const ind of countable) {
    const raw = achievementRatio(ind);
    if (raw === null) continue;
    const ratio = Math.max(0, Math.min(raw, cap));
    weighted += ind.weight * ratio;
    weightSum += ind.weight;
    filled += 1;
    if (ratio < weakestRatio) {
      weakestRatio = ratio;
      weakest = ind.id;
    }
  }

  if (filled === 0 || weightSum === 0) {
    return { score: null, filled: 0, expected, weakest: null };
  }
  return { score: round2((weighted / weightSum) * 100), filled, expected, weakest };
}

export function classifyDpi(score: number | null, green = 90, yellow = 70): TrafficLight {
  if (score === null || score === undefined || Number.isNaN(score)) return 'NO_DATA';
  if (score >= green) return 'GREEN';
  if (score >= yellow) return 'YELLOW';
  return 'RED';
}

export function applyAttendance(
  status: TrafficLight,
  attendance: AttendanceSignal,
  demote = true,
): TrafficLight {
  if (!demote || attendance !== 'ABSENT') return status;
  if (status === 'GREEN') return 'YELLOW';
  if (status === 'YELLOW') return 'RED';
  return status;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/dpiEngine.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/dpiEngine.ts tests/unit/dpiEngine.test.ts
git commit -m "feat(engine): DPI murni + ambang traffic light (PRD v2 fase 1)"
```

---

### Task 6: Employment status service and routes

**Files:**
- Create: `src/lib/services/employmentStatusService.ts`
- Create: `src/app/api/v1/me/employment-status/route.ts`
- Create: `src/app/api/v1/hr/employment-status/route.ts`
- Create: `src/app/api/v1/hr/employees/[id]/employment-status/route.ts`
- Modify: `src/lib/auth/rbac.ts` (add `employment:read`, `employment:manage`)
- Test: `tests/api/employment-status-routes.test.ts`

**Interfaces:**
- Consumes: `employment_status_history`, `employees.employment_status` (Task 1).
- Produces:
  - `getEmploymentStatus(db: Db, employeeId: string): Promise<EmploymentStatusRow | null>`
  - `changeEmploymentStatus(db: Db, input: { employeeId: string; newStatus: EmploymentStatus; effectiveDate: string; reason: string; decidedBy: string }): Promise<EmploymentStatusRow>`
  - `listByStatus(db: Db, status?: EmploymentStatus): Promise<EmploymentStatusRow[]>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getMine } from '@/app/api/v1/me/employment-status/route';
import { PUT as putStatus } from '@/app/api/v1/hr/employees/[id]/employment-status/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

const putReq = (path: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'PUT',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('employment status routes', () => {
  let client: PGlite;
  let empCookie = '';
  let hrCookie = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('karyawan membaca statusnya sendiri', async () => {
    const res = await getMine(getReq('/api/v1/me/employment-status', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('PROBATION');
  });

  it('karyawan tidak boleh mengubah status', async () => {
    const res = await putStatus(
      putReq(`/api/v1/hr/employees/${BUDI}/employment-status`,
        { newStatus: 'TETAP', effectiveDate: '2026-10-21', reason: 'pengangkatan' }, empCookie),
      { params: { id: BUDI } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('HR mengubah ke TETAP dan riwayat tercatat', async () => {
    const res = await putStatus(
      putReq(`/api/v1/hr/employees/${BUDI}/employment-status`,
        { newStatus: 'TETAP', effectiveDate: '2026-10-21', reason: 'pengangkatan' }, hrCookie),
      { params: { id: BUDI } } as any,
    );
    expect(res.status).toBe(200);

    const mine = await getMine(getReq('/api/v1/me/employment-status', empCookie));
    const json = await mine.json();
    expect(json.data.status).toBe('TETAP');
    expect(json.data.appointmentDate).toBe('2026-10-21');
    expect(json.data.history.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/employment-status-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Add permissions**

In `src/lib/auth/rbac.ts`, extend the union and matrix:

```ts
| 'employment:read'
| 'employment:manage'
```

```ts
'employment:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'employment:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
```

- [ ] **Step 4: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export type EmploymentStatus =
  | 'PROBATION' | 'PKWT' | 'PKWTT' | 'TETAP' | 'RESIGNED' | 'RETIRED';

export interface EmploymentStatusRow {
  employeeId: string;
  fullName: string;
  status: EmploymentStatus;
  joinDate: string;
  appointmentDate: string | null;
  history?: Array<{
    previousStatus: EmploymentStatus | null;
    newStatus: EmploymentStatus;
    effectiveDate: string;
    reason: string | null;
  }>;
}

export async function getEmploymentStatus(db: Db, employeeId: string): Promise<EmploymentStatusRow | null> {
  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.full_name AS "fullName",
           e.employment_status AS status, e.join_date AS "joinDate",
           e.appointment_date AS "appointmentDate"
      FROM employees e WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: EmploymentStatusRow[] };
  const row = res.rows?.[0];
  if (!row) return null;

  const hist = (await db.execute(sql`
    SELECT previous_status AS "previousStatus", new_status AS "newStatus",
           effective_date AS "effectiveDate", reason
      FROM employment_status_history
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY effective_date DESC, created_at DESC
  `)) as unknown as { rows: NonNullable<EmploymentStatusRow['history']> };

  return { ...row, history: hist.rows ?? [] };
}

export async function changeEmploymentStatus(
  db: Db,
  input: {
    employeeId: string;
    newStatus: EmploymentStatus;
    effectiveDate: string;
    reason: string;
    decidedBy: string;
  },
): Promise<EmploymentStatusRow> {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan perubahan status wajib diisi (minimal 5 karakter).');
  }

  const before = await getEmploymentStatus(db, input.employeeId);
  if (!before) throw new BusinessRuleError('Karyawan tidak ditemukan.');
  if (before.status === input.newStatus) {
    throw new BusinessRuleError(`Status sudah ${input.newStatus}; tidak ada perubahan untuk dicatat.`);
  }

  await db.execute(sql`
    WITH prev AS (
      SELECT employment_status FROM employees WHERE id = ${input.employeeId}::uuid
    ), upd AS (
      UPDATE employees
         SET employment_status = ${input.newStatus}::employment_status_enum,
             appointment_date = CASE
               WHEN ${input.newStatus} = 'TETAP' THEN ${input.effectiveDate}::date
               ELSE appointment_date END
       WHERE id = ${input.employeeId}::uuid
      RETURNING id
    )
    INSERT INTO employment_status_history
      (employee_id, previous_status, new_status, effective_date, reason, decided_by)
    SELECT ${input.employeeId}::uuid, prev.employment_status,
           ${input.newStatus}::employment_status_enum, ${input.effectiveDate}::date,
           ${input.reason}, ${input.decidedBy}::uuid
      FROM prev
  `);

  const after = await getEmploymentStatus(db, input.employeeId);
  if (!after) throw new BusinessRuleError('Status gagal dibaca setelah perubahan.');
  return after;
}

export async function listByStatus(db: Db, status?: EmploymentStatus): Promise<EmploymentStatusRow[]> {
  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.full_name AS "fullName",
           e.employment_status AS status, e.join_date AS "joinDate",
           e.appointment_date AS "appointmentDate"
      FROM employees e
     WHERE (${status ?? null}::employment_status_enum IS NULL
            OR e.employment_status = ${status ?? null}::employment_status_enum)
     ORDER BY e.full_name
  `)) as unknown as { rows: EmploymentStatusRow[] };
  return res.rows ?? [];
}
```

- [ ] **Step 5: Write the three routes**

`src/app/api/v1/me/employment-status/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getEmploymentStatus } from '@/lib/services/employmentStatusService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const row = await getEmploymentStatus(db, session.employeeId);
    if (!row) return fail('NOT_FOUND', 'Data kepegawaian tidak ditemukan.', 404);
    return ok(row);
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat status kepegawaian', 500);
  }
}
```

`src/app/api/v1/hr/employment-status/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listByStatus, type EmploymentStatus } from '@/lib/services/employmentStatusService';

const VALID: EmploymentStatus[] = ['PROBATION', 'PKWT', 'PKWTT', 'TETAP', 'RESIGNED', 'RETIRED'];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:read');

    const raw = req.nextUrl.searchParams.get('status');
    if (raw && !VALID.includes(raw as EmploymentStatus)) {
      return fail('VALIDATION_ERROR', `Status '${raw}' tidak dikenal.`, 400);
    }
    const items = await listByStatus(db, (raw as EmploymentStatus) ?? undefined);
    return ok({ items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat daftar status', 500);
  }
}
```

`src/app/api/v1/hr/employees/[id]/employment-status/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { changeEmploymentStatus } from '@/lib/services/employmentStatusService';

const BodySchema = z.object({
  newStatus: z.enum(['PROBATION', 'PKWT', 'PKWTT', 'TETAP', 'RESIGNED', 'RETIRED']),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(5),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:manage');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await changeEmploymentStatus(db, {
      employeeId: params.id,
      newStatus: parsed.data.newStatus,
      effectiveDate: parsed.data.effectiveDate,
      reason: parsed.data.reason,
      decidedBy: session.userId,
    });
    return ok(row, 'Status kepegawaian diperbarui.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengubah status', status);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/api/employment-status-routes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/employmentStatusService.ts src/app/api/v1/me/employment-status src/app/api/v1/hr/employment-status "src/app/api/v1/hr/employees/[id]/employment-status" src/lib/auth/rbac.ts tests/api/employment-status-routes.test.ts
git commit -m "feat(employee): status kepegawaian service + routes (PRD v2 fase 1)"
```

---

### Task 7: Daily KPI service and routes

**Files:**
- Create: `src/lib/services/dailyKpiService.ts`
- Create: `src/app/api/v1/me/kpi-indicators/route.ts`
- Create: `src/app/api/v1/me/kpi-daily-entries/route.ts`
- Create: `src/app/api/v1/performance/kpi-daily-entries/[id]/verify/route.ts`
- Test: `tests/api/daily-kpi-routes.test.ts`

**Interfaces:**
- Consumes: `kpi_indicators`, `kpi_daily_entries` (Task 3), `appendActivity` (Task 2).
- Produces:
  - `listDailyIndicators(db, employeeId): Promise<IndicatorRow[]>`
  - `saveEntry(db, input): Promise<EntryRow>` where input is `{ employeeId, indicatorId, entryDate, actualValue, note?, evidenceUrl?, submit: boolean }`
  - `listEntries(db, employeeId, from: string, to: string): Promise<EntryRow[]>`
  - `verifyEntry(db, input: { entryId, verifierId, decision: 'VERIFIED' | 'REJECTED', reason?: string }): Promise<EntryRow>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getIndicators } from '@/app/api/v1/me/kpi-indicators/route';
import { GET as getEntries, POST as postEntry } from '@/app/api/v1/me/kpi-daily-entries/route';
import { PUT as putVerify } from '@/app/api/v1/performance/kpi-daily-entries/[id]/verify/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';

const cookie = (value: string) => new Headers({ cookie: value });
const getReq = (path: string, c: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: cookie(c) });
const jsonReq = (path: string, method: string, body: unknown, c: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie: c }),
    body: JSON.stringify(body),
  });

describe('daily KPI routes', () => {
  let client: PGlite;
  let db: any;
  let empCookie = '';
  let mgrCookie = '';
  let indicatorId = '';
  let entryId = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    const kpi = await db.execute(`
      SELECT id FROM individual_kpis WHERE employee_id = '${BUDI}' LIMIT 1`);
    const kpiId = kpi.rows[0].id;
    const ind = await db.execute(`
      INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value, indicator_weight)
      VALUES ('${kpiId}', 'Tiket selesai', 10, 100) RETURNING id`);
    indicatorId = ind.rows[0].id;

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000002', employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('karyawan melihat indikator harian aktif', async () => {
    const res = await getIndicators(getReq('/api/v1/me/kpi-indicators', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.some((i: any) => i.id === indicatorId)).toBe(true);
  });

  it('menyimpan draf lalu mengirim entri', async () => {
    const draft = await postEntry(jsonReq('/api/v1/me/kpi-daily-entries', 'POST', {
      indicatorId, entryDate: '2026-10-21', actualValue: 8, note: 'delapan tiket', submit: false,
    }, empCookie));
    expect(draft.status).toBe(200);
    expect((await draft.json()).data.status).toBe('DRAFT');

    const sent = await postEntry(jsonReq('/api/v1/me/kpi-daily-entries', 'POST', {
      indicatorId, entryDate: '2026-10-21', actualValue: 9, submit: true,
    }, empCookie));
    expect(sent.status).toBe(200);
    const json = await sent.json();
    expect(json.data.status).toBe('SUBMITTED');
    entryId = json.data.id;
  });

  it('menolak nilai negatif', async () => {
    const res = await postEntry(jsonReq('/api/v1/me/kpi-daily-entries', 'POST', {
      indicatorId, entryDate: '2026-10-22', actualValue: -1, submit: true,
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('atasan memverifikasi entri', async () => {
    const res = await putVerify(
      jsonReq(`/api/v1/performance/kpi-daily-entries/${entryId}/verify`, 'PUT', { decision: 'VERIFIED' }, mgrCookie),
      { params: { id: entryId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('VERIFIED');
  });

  it('verifikasi kedua ditolak (sudah final)', async () => {
    const res = await putVerify(
      jsonReq(`/api/v1/performance/kpi-daily-entries/${entryId}/verify`, 'PUT', { decision: 'REJECTED', reason: 'salah' }, mgrCookie),
      { params: { id: entryId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rekap entri mengembalikan entri yang dikirim', async () => {
    const res = await getEntries(getReq('/api/v1/me/kpi-daily-entries?from=2026-10-01&to=2026-10-31', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.find((i: any) => i.id === entryId)?.status).toBe('VERIFIED');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/daily-kpi-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';

export interface IndicatorRow {
  id: string;
  kpiId: string;
  kpiTitle: string;
  indicatorName: string;
  unit: string;
  target: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  aggregation: 'SUM' | 'AVG' | 'LAST' | 'MAX';
  weight: number;
}

export interface EntryRow {
  id: string;
  indicatorId: string;
  employeeId: string;
  entryDate: string;
  actualValue: number;
  note: string | null;
  evidenceUrl: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  isLate: boolean;
  rejectionReason: string | null;
}

export async function listDailyIndicators(db: Db, employeeId: string): Promise<IndicatorRow[]> {
  const res = (await db.execute(sql`
    SELECT i.id, i.kpi_id AS "kpiId", k.kpi_title AS "kpiTitle",
           i.indicator_name AS "indicatorName", i.unit_of_measure AS unit,
           i.target_value::float8 AS target, i.direction, i.frequency, i.aggregation,
           i.indicator_weight::float8 AS weight
      FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
     WHERE k.employee_id = ${employeeId}::uuid
       AND i.is_active = TRUE
       AND i.frequency = 'DAILY'
     ORDER BY k.kpi_title, i.indicator_name
  `)) as unknown as { rows: IndicatorRow[] };
  return res.rows ?? [];
}

export async function saveEntry(
  db: Db,
  input: {
    employeeId: string;
    indicatorId: string;
    entryDate: string;
    actualValue: number;
    note?: string;
    evidenceUrl?: string;
    submit: boolean;
  },
): Promise<EntryRow> {
  if (!Number.isFinite(input.actualValue) || input.actualValue < 0) {
    throw new BusinessRuleError('Nilai realisasi tidak boleh negatif.');
  }

  // Kepemilikan: indikator harus milik KPI karyawan ini.
  const owner = (await db.execute(sql`
    SELECT 1 FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
     WHERE i.id = ${input.indicatorId}::uuid AND k.employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: unknown[] };
  if (!owner.rows?.length) {
    throw new BusinessRuleError('Indikator tidak ditemukan untuk karyawan ini.');
  }

  // Batas kirim 23.59 waktu kantor; setelah itu ditandai terlambat, bukan ditolak.
  const status = input.submit ? 'SUBMITTED' : 'DRAFT';
  const res = (await db.execute(sql`
    INSERT INTO kpi_daily_entries
      (indicator_id, employee_id, entry_date, actual_value, note, evidence_url, status,
       is_late, submitted_at, updated_at)
    VALUES (${input.indicatorId}::uuid, ${input.employeeId}::uuid, ${input.entryDate}::date,
            ${input.actualValue}, ${input.note ?? null}, ${input.evidenceUrl ?? null},
            ${status}::daily_entry_status_enum,
            ${input.submit} AND (NOW() AT TIME ZONE 'Asia/Jakarta')::time > TIME '23:59',
            CASE WHEN ${input.submit} THEN CURRENT_TIMESTAMP ELSE NULL END,
            CURRENT_TIMESTAMP)
    ON CONFLICT (indicator_id, employee_id, entry_date) DO UPDATE
      SET actual_value = EXCLUDED.actual_value,
          note = EXCLUDED.note,
          evidence_url = EXCLUDED.evidence_url,
          status = CASE
            WHEN kpi_daily_entries.status = 'VERIFIED' THEN kpi_daily_entries.status
            ELSE EXCLUDED.status END,
          is_late = EXCLUDED.is_late,
          submitted_at = COALESCE(EXCLUDED.submitted_at, kpi_daily_entries.submitted_at),
          updated_at = CURRENT_TIMESTAMP
    RETURNING id, indicator_id AS "indicatorId", employee_id AS "employeeId",
              entry_date AS "entryDate", actual_value::float8 AS "actualValue",
              note, evidence_url AS "evidenceUrl", status, is_late AS "isLate",
              rejection_reason AS "rejectionReason"
  `)) as unknown as { rows: EntryRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Entri harian gagal disimpan.');

  if (input.submit) {
    await appendActivity(db, {
      employeeId: input.employeeId,
      eventType: 'KPI_DAILY',
      entityId: row.id,
      summary: `Mengirim realisasi indikator (${input.actualValue}) untuk ${input.entryDate}`,
    });
  }
  return row;
}

export async function listEntries(
  db: Db,
  employeeId: string,
  from: string,
  to: string,
): Promise<EntryRow[]> {
  const res = (await db.execute(sql`
    SELECT id, indicator_id AS "indicatorId", employee_id AS "employeeId",
           entry_date AS "entryDate", actual_value::float8 AS "actualValue",
           note, evidence_url AS "evidenceUrl", status, is_late AS "isLate",
           rejection_reason AS "rejectionReason"
      FROM kpi_daily_entries
     WHERE employee_id = ${employeeId}::uuid
       AND entry_date BETWEEN ${from}::date AND ${to}::date
     ORDER BY entry_date DESC
  `)) as unknown as { rows: EntryRow[] };
  return res.rows ?? [];
}

export async function verifyEntry(
  db: Db,
  input: { entryId: string; verifierId: string; decision: 'VERIFIED' | 'REJECTED'; reason?: string },
): Promise<EntryRow> {
  const current = (await db.execute(sql`
    SELECT status FROM kpi_daily_entries WHERE id = ${input.entryId}::uuid
  `)) as unknown as { rows: Array<{ status: string }> };
  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Entri tidak ditemukan.');
  if (row.status === 'VERIFIED' || row.status === 'REJECTED') {
    throw new BusinessRuleError(`Entri sudah final (${row.status}); keputusan tidak dapat diubah.`);
  }
  if (input.decision === 'REJECTED' && !input.reason) {
    throw new BusinessRuleError('Penolakan wajib menyertakan alasan.');
  }

  const res = (await db.execute(sql`
    UPDATE kpi_daily_entries
       SET status = ${input.decision}::daily_entry_status_enum,
           verified_by = ${input.verifierId}::uuid,
           verified_at = CURRENT_TIMESTAMP,
           rejection_reason = ${input.decision === 'REJECTED' ? input.reason! : null},
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${input.entryId}::uuid
    RETURNING id, indicator_id AS "indicatorId", employee_id AS "employeeId",
              entry_date AS "entryDate", actual_value::float8 AS "actualValue",
              note, evidence_url AS "evidenceUrl", status, is_late AS "isLate",
              rejection_reason AS "rejectionReason"
  `)) as unknown as { rows: EntryRow[] };

  return res.rows[0];
}
```

- [ ] **Step 4: Write the three routes**

`src/app/api/v1/me/kpi-indicators/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listDailyIndicators } from '@/lib/services/dailyKpiService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const items = await listDailyIndicators(db, session.employeeId);
    return ok({ items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat indikator harian', 500);
  }
}
```

`src/app/api/v1/me/kpi-daily-entries/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listEntries, saveEntry } from '@/lib/services/dailyKpiService';

const EntrySchema = z.object({
  indicatorId: z.string().uuid(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualValue: z.number().min(0),
  note: z.string().max(500).optional(),
  evidenceUrl: z.string().url().optional(),
  submit: z.boolean().default(false),
});

const isoDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const today = isoDay();
    const from = req.nextUrl.searchParams.get('from') ?? today;
    const to = req.nextUrl.searchParams.get('to') ?? today;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(from) || !dateRe.test(to)) {
      return fail('VALIDATION_ERROR', 'Format tanggal harus YYYY-MM-DD.', 400);
    }

    const items = await listEntries(db, session.employeeId, from, to);
    return ok({ items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat entri harian', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = EntrySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await saveEntry(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, parsed.data.submit ? 'Realisasi terkirim.' : 'Draf tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menyimpan entri', status);
  }
}
```

`src/app/api/v1/performance/kpi-daily-entries/[id]/verify/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { verifyEntry } from '@/lib/services/dailyKpiService';

const BodySchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  reason: z.string().max(500).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:approve');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await verifyEntry(db, {
      entryId: params.id,
      verifierId: session.userId,
      decision: parsed.data.decision,
      reason: parsed.data.reason,
    });
    return ok(row, 'Keputusan verifikasi tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memverifikasi entri', status);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/api/daily-kpi-routes.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/dailyKpiService.ts src/app/api/v1/me/kpi-indicators src/app/api/v1/me/kpi-daily-entries "src/app/api/v1/performance/kpi-daily-entries" tests/api/daily-kpi-routes.test.ts
git commit -m "feat(kpi): input harian per indikator + verifikasi atasan (PRD v2 fase 1)"
```

---

### Task 8: Daily snapshot, recap, and period rollup

**Files:**
- Create: `src/lib/services/dailyPerformanceService.ts`
- Create: `src/app/api/v1/me/daily-status/route.ts`
- Create: `src/app/api/v1/me/performance-recap/route.ts`
- Create: `src/app/api/v1/performance/daily-status/team/route.ts`
- Test: `tests/integration/dailyPerformanceService.test.ts`

**Interfaces:**
- Consumes: `dpiEngine` (Task 5), `dailyKpiService.listDailyIndicators` (Task 7), `company_dpi_settings` + `daily_performance_snapshots` (Task 4).
- Produces:
  - `getDpiSettings(db, companyId?: string): Promise<DpiSettings>`
  - `computeSnapshot(db, employeeId: string, date: string): Promise<SnapshotRow>`
  - `storeSnapshot(db, employeeId: string, date: string): Promise<SnapshotRow>`
  - `getRecap(db, employeeId: string, period: 'daily' | 'monthly' | 'yearly', anchor?: string): Promise<RecapRow>`
  - `rollupPeriod(db, employeeId: string, periodId: string): Promise<{ updated: number }>`
  - `listTeamStatus(db, managerEmployeeId: string, date: string): Promise<SnapshotRow[]>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  computeSnapshot, storeSnapshot, getRecap, rollupPeriod, listTeamStatus,
} from '@/lib/services/dailyPerformanceService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('dailyPerformanceService', () => {
  let client: PGlite;
  let db: any;
  let kpiId = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    const kpi = await db.execute(`SELECT id FROM individual_kpis WHERE employee_id = '${BUDI}' LIMIT 1`);
    kpiId = kpi.rows[0].id;
    await db.execute(`
      INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value, indicator_weight, aggregation)
      VALUES ('${kpiId}', 'Tiket selesai', 10, 60, 'SUM'),
             ('${kpiId}', 'Waktu respons (jam)', 2, 40, 'AVG')`);
  });
  afterAll(async () => { await client.close(); });

  it('tanpa entri → NO_DATA dan skor null', async () => {
    const snap = await computeSnapshot(db, BUDI, '2026-10-01');
    expect(snap.score).toBeNull();
    expect(snap.trafficLight).toBe('NO_DATA');
  });

  it('entri terkirim menghasilkan DPI & warna', async () => {
    const inds = await db.execute(`
      SELECT id, indicator_name FROM kpi_indicators WHERE kpi_id = '${kpiId}' ORDER BY indicator_name`);
    const tiket = inds.rows.find((r: any) => r.indicator_name === 'Tiket selesai');
    const respons = inds.rows.find((r: any) => r.indicator_name === 'Waktu respons (jam)');
    await db.execute(`
      INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value, status)
      VALUES ('${tiket.id}', '${BUDI}', '2026-10-02', 10, 'SUBMITTED'),
             ('${respons.id}', '${BUDI}', '2026-10-02', 2, 'SUBMITTED')`);
    const snap = await computeSnapshot(db, BUDI, '2026-10-02');
    expect(snap.score).toBeCloseTo(100, 1);
    expect(snap.trafficLight).toBe('GREEN');
    expect(snap.filled).toBe(2);
  });

  it('snapshot tersimpan idempoten', async () => {
    const a = await storeSnapshot(db, BUDI, '2026-10-02');
    const b = await storeSnapshot(db, BUDI, '2026-10-02');
    expect(a.score).toBeCloseTo(b.score!, 4);
    const count = await db.execute(`
      SELECT count(*)::int AS n FROM daily_performance_snapshots
       WHERE employee_id = '${BUDI}' AND snapshot_date = '2026-10-02'`);
    expect(count.rows[0].n).toBe(1);
  });

  it('rollup SUM mengisi actual_value KPI', async () => {
    await db.execute(`UPDATE kpi_indicators SET aggregation = 'SUM' WHERE kpi_id = '${kpiId}'`);
    const period = await db.execute(`SELECT period_id FROM individual_kpis WHERE id = '${kpiId}'`);
    await rollupPeriod(db, BUDI, period.rows[0].period_id);
    const kpi = await db.execute(`SELECT actual_value::float8 AS v FROM individual_kpis WHERE id = '${kpiId}'`);
    expect(kpi.rows[0].v).toBeGreaterThan(0);
  });

  it('rekap bulanan memakai view', async () => {
    const recap = await getRecap(db, BUDI, 'monthly', '2026-10-15');
    expect(recap.periodMonth).toBe('2026-10-01');
    expect(recap.daysGreen).toBeGreaterThanOrEqual(1);
  });

  it('status tim memuat bawahan', async () => {
    const rows = await listTeamStatus(db, 'b0000000-0000-4000-8000-000000000002', '2026-10-02');
    expect(Array.isArray(rows)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/dailyPerformanceService.test.ts`
Expected: FAIL — cannot resolve `@/lib/services/dailyPerformanceService`.

- [ ] **Step 3: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  applyAttendance, classifyDpi, computeDpi,
  type AttendanceSignal, type DpiIndicator, type TrafficLight,
} from '@/lib/engines/dpiEngine';
import { appendActivity } from './activityFeedService';

export interface DpiSettings {
  green: number;
  yellow: number;
  cap: number;
  absenceDemotes: boolean;
}

export interface SnapshotRow {
  employeeId: string;
  date: string;
  score: number | null;
  trafficLight: TrafficLight;
  filled: number;
  expected: number;
  demotionReason: string | null;
  weakest: string | null;
}

export interface RecapRow {
  periodMonth: string;
  daysGreen: number;
  daysYellow: number;
  daysRed: number;
  daysNoData: number;
  avgDpi: number | null;
  entryAdherence: number | null;
}

const DEFAULT_SETTINGS: DpiSettings = { green: 90, yellow: 70, cap: 1.2, absenceDemotes: true };

export async function getDpiSettings(db: Db): Promise<DpiSettings> {
  const res = (await db.execute(sql`
    SELECT green_threshold::float8 AS green, yellow_threshold::float8 AS yellow,
           achievement_cap::float8 AS cap, absence_demotes AS "absenceDemotes"
      FROM company_dpi_settings LIMIT 1
  `)) as unknown as { rows: DpiSettings[] };
  return res.rows?.[0] ?? DEFAULT_SETTINGS;
}

/** Sinyal kehadiran dari attendance_logs; hari tanpa baris absensi = ABSENT. */
async function attendanceSignal(db: Db, employeeId: string, date: string): Promise<AttendanceSignal> {
  const res = (await db.execute(sql`
    SELECT check_in_at AS "checkInAt", status
      FROM attendance_logs
     WHERE employee_id = ${employeeId}::uuid AND work_date = ${date}::date
  `)) as unknown as { rows: Array<{ checkInAt: string | null; status: string }> };
  const row = res.rows?.[0];
  if (!row || !row.checkInAt) return 'ABSENT';
  if (row.status === 'REJECTED') return 'ABSENT';
  return 'PRESENT';
}

export async function computeSnapshot(db: Db, employeeId: string, date: string): Promise<SnapshotRow> {
  const settings = await getDpiSettings(db);

  const rows = (await db.execute(sql`
    SELECT i.id, i.indicator_weight::float8 AS weight,
           i.target_value::float8 AS target,
           e.actual_value::float8 AS actual,
           i.direction
      FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
      LEFT JOIN kpi_daily_entries e
        ON e.indicator_id = i.id
       AND e.employee_id = ${employeeId}::uuid
       AND e.entry_date = ${date}::date
       AND e.status IN ('SUBMITTED', 'VERIFIED')
     WHERE k.employee_id = ${employeeId}::uuid
       AND i.is_active = TRUE
       AND i.frequency = 'DAILY'
  `)) as unknown as {
    rows: Array<{ id: string; weight: number; target: number; actual: number | null; direction: DpiIndicator['direction'] }>;
  };

  const indicators: DpiIndicator[] = (rows.rows ?? []).map((r) => ({
    id: r.id,
    weight: Number(r.weight),
    target: Number(r.target),
    actual: r.actual === null ? null : Number(r.actual),
    direction: r.direction,
  }));

  const result = computeDpi(indicators, settings.cap);
  const base = classifyDpi(result.score, settings.green, settings.yellow);

  const signal = await attendanceSignal(db, employeeId, date);
  const final = applyAttendance(base, signal, settings.absenceDemotes);
  const demoted = final !== base;

  return {
    employeeId,
    date,
    score: result.score,
    trafficLight: final,
    filled: result.filled,
    expected: result.expected,
    demotionReason: demoted ? 'ABSENT_WITHOUT_NOTICE' : null,
    weakest: result.weakest,
  };
}

export async function storeSnapshot(db: Db, employeeId: string, date: string): Promise<SnapshotRow> {
  const snap = await computeSnapshot(db, employeeId, date);

  await db.execute(sql`
    INSERT INTO daily_performance_snapshots
      (employee_id, snapshot_date, dpi_score, traffic_light,
       indicators_expected, indicators_filled, demotion_reason, computed_at)
    VALUES (${employeeId}::uuid, ${date}::date, ${snap.score},
            ${snap.trafficLight}::traffic_light_enum, ${snap.expected}, ${snap.filled},
            ${snap.demotionReason}, CURRENT_TIMESTAMP)
    ON CONFLICT (employee_id, snapshot_date) DO UPDATE
      SET dpi_score = EXCLUDED.dpi_score,
          traffic_light = EXCLUDED.traffic_light,
          indicators_expected = EXCLUDED.indicators_expected,
          indicators_filled = EXCLUDED.indicators_filled,
          demotion_reason = EXCLUDED.demotion_reason,
          computed_at = CURRENT_TIMESTAMP
  `);

  await appendActivity(db, {
    employeeId,
    eventType: 'DPI_STATUS',
    summary: `Status ${snap.trafficLight} (DPI ${snap.score ?? '-'}) pada ${date}`,
    occurredAt: `${date}T23:59:00+07:00`,
  });

  return snap;
}

export async function getRecap(
  db: Db,
  employeeId: string,
  period: 'daily' | 'monthly' | 'yearly',
  anchor?: string,
): Promise<RecapRow & { period: string }> {
  if (period === 'daily') {
    const snap = await computeSnapshot(db, employeeId, anchor ?? new Date().toISOString().slice(0, 10));
    return {
      period,
      periodMonth: snap.date,
      daysGreen: snap.trafficLight === 'GREEN' ? 1 : 0,
      daysYellow: snap.trafficLight === 'YELLOW' ? 1 : 0,
      daysRed: snap.trafficLight === 'RED' ? 1 : 0,
      daysNoData: snap.trafficLight === 'NO_DATA' ? 1 : 0,
      avgDpi: snap.score,
      entryAdherence: snap.expected > 0 ? snap.filled / snap.expected : null,
    };
  }

  const bucket = period === 'monthly' ? 'month' : 'year';
  const res = (await db.execute(sql`
    SELECT to_char(date_trunc(${bucket}, snapshot_date), 'YYYY-MM-DD') AS "periodMonth",
           count(*) FILTER (WHERE traffic_light = 'GREEN')::int AS "daysGreen",
           count(*) FILTER (WHERE traffic_light = 'YELLOW')::int AS "daysYellow",
           count(*) FILTER (WHERE traffic_light = 'RED')::int AS "daysRed",
           count(*) FILTER (WHERE traffic_light = 'NO_DATA')::int AS "daysNoData",
           round(avg(dpi_score) FILTER (WHERE dpi_score IS NOT NULL), 2)::float8 AS "avgDpi",
           (sum(indicators_filled)::numeric / NULLIF(sum(indicators_expected), 0))::float8 AS "entryAdherence"
      FROM daily_performance_snapshots
     WHERE employee_id = ${employeeId}::uuid
       AND date_trunc(${bucket}, snapshot_date)
           = date_trunc(${bucket}, COALESCE(${anchor ?? null}::date, CURRENT_DATE))
     GROUP BY 1
  `)) as unknown as { rows: RecapRow[] };

  const row = res.rows?.[0];
  return {
    period,
    periodMonth: row?.periodMonth ?? '',
    daysGreen: Number(row?.daysGreen ?? 0),
    daysYellow: Number(row?.daysYellow ?? 0),
    daysRed: Number(row?.daysRed ?? 0),
    daysNoData: Number(row?.daysNoData ?? 0),
    avgDpi: row?.avgDpi ?? null,
    entryAdherence: row?.entryAdherence ?? null,
  };
}

/**
 * Rollup entri terverifikasi/terkirim dalam satu periode ke
 * individual_kpis.actual_value, memakai aturan agregasi tiap indikator.
 * Idempoten: hasilnya sama bila dijalankan berulang.
 */
export async function rollupPeriod(db: Db, employeeId: string, periodId: string): Promise<{ updated: number }> {
  const agg = (await db.execute(sql`
    SELECT i.kpi_id AS "kpiId",
           SUM(CASE i.aggregation
                 WHEN 'SUM'  THEN e.total
                 WHEN 'AVG'  THEN e.total / NULLIF(e.n, 0)
                 WHEN 'MAX'  THEN e.max_value
                 WHEN 'LAST' THEN e.last_value
               END)::float8 AS "actualValue"
      FROM kpi_indicators i
      JOIN (
        SELECT indicator_id,
               sum(actual_value) AS total,
               count(*) AS n,
               max(actual_value) AS max_value,
               (array_agg(actual_value ORDER BY entry_date DESC))[1] AS last_value
          FROM kpi_daily_entries
         WHERE employee_id = ${employeeId}::uuid
           AND status IN ('SUBMITTED', 'VERIFIED')
           AND entry_date >= (SELECT start_date FROM appraisal_periods WHERE id = ${periodId}::uuid)
           AND entry_date <= (SELECT end_date FROM appraisal_periods WHERE id = ${periodId}::uuid)
         GROUP BY indicator_id
      ) e ON e.indicator_id = i.id
     WHERE i.is_active = TRUE
     GROUP BY i.kpi_id
  `)) as unknown as { rows: Array<{ kpiId: string; actualValue: number }> };

  let updated = 0;
  for (const row of agg.rows ?? []) {
    await db.execute(sql`
      UPDATE individual_kpis
         SET actual_value = ${Number(row.actualValue)}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ${row.kpiId}::uuid AND employee_id = ${employeeId}::uuid
    `);
    updated += 1;
  }
  return { updated };
}

export async function listTeamStatus(
  db: Db,
  managerEmployeeId: string,
  date: string,
): Promise<SnapshotRow[]> {
  const res = (await db.execute(sql`
    WITH RECURSIVE reports AS (
      SELECT id FROM employees WHERE manager_id = ${managerEmployeeId}::uuid
      UNION
      SELECT e.id FROM employees e JOIN reports r ON e.manager_id = r.id
    )
    SELECT s.employee_id AS "employeeId", s.snapshot_date AS date,
           s.dpi_score::float8 AS score, s.traffic_light AS "trafficLight",
           s.indicators_filled AS filled, s.indicators_expected AS expected,
           s.demotion_reason AS "demotionReason"
      FROM daily_performance_snapshots s
      JOIN reports r ON r.id = s.employee_id
      JOIN employees e ON e.id = s.employee_id
     WHERE s.snapshot_date = ${date}::date
     ORDER BY s.traffic_light, e.full_name
  `)) as unknown as { rows: SnapshotRow[] };
  return res.rows ?? [];
}
```

Bawahan langsung dan tidak langsung tercakup oleh CTE rekursif di atas, sesuai PRD §6.2 (`People Manager` melihat bawahan langsung dan tidak langsung).

- [ ] **Step 4: Write the three routes**

`src/app/api/v1/me/daily-status/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { computeSnapshot, getDpiSettings } from '@/lib/services/dailyPerformanceService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const date = req.nextUrl.searchParams.get('date')
      ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    const [snapshot, settings] = await Promise.all([
      computeSnapshot(db, session.employeeId, date),
      getDpiSettings(db),
    ]);
    return ok({ ...snapshot, thresholds: settings });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal menghitung status harian', 500);
  }
}
```

`src/app/api/v1/me/performance-recap/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getRecap } from '@/lib/services/dailyPerformanceService';

const PERIODS = ['daily', 'monthly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const raw = req.nextUrl.searchParams.get('period') ?? 'monthly';
    if (!PERIODS.includes(raw as Period)) {
      return fail('VALIDATION_ERROR', `Period harus salah satu: ${PERIODS.join(', ')}.`, 400);
    }
    const anchor = req.nextUrl.searchParams.get('anchor') ?? undefined;
    if (anchor && !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
      return fail('VALIDATION_ERROR', 'anchor harus berformat YYYY-MM-DD.', 400);
    }

    const recap = await getRecap(db, session.employeeId, raw as Period, anchor);
    return ok(recap);
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat rekap', 500);
  }
}
```

`src/app/api/v1/performance/daily-status/team/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listTeamStatus } from '@/lib/services/dailyPerformanceService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:approve');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const date = req.nextUrl.searchParams.get('date')
      ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    const items = await listTeamStatus(db, session.employeeId, date);
    return ok({ date, items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat status tim', 500);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/dailyPerformanceService.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/dailyPerformanceService.ts src/app/api/v1/me/daily-status src/app/api/v1/me/performance-recap src/app/api/v1/performance/daily-status tests/integration/dailyPerformanceService.test.ts
git commit -m "feat(perf): snapshot DPI, rekap, rollup periode (PRD v2 fase 1)"
```

---

### Task 9: Daily Cockpit UI

**Files:**
- Create: `src/components/employee/DailyStatusCard.tsx`
- Create: `src/components/employee/DailyKpiChecklist.tsx`
- Create: `src/components/employee/PerformanceRecapTabs.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx` (mount the cockpit at the top of the `DURING` phase, before `<FeatureGrid>`)
- Test: `tests/ui/daily-cockpit.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/me/daily-status`, `GET /api/v1/me/kpi-indicators`, `POST /api/v1/me/kpi-daily-entries`, `GET /api/v1/me/performance-recap`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DailyStatusCard from '@/components/employee/DailyStatusCard';
import DailyKpiChecklist from '@/components/employee/DailyKpiChecklist';

const status = {
  employeeId: 'b1', date: '2026-10-21', score: 64.5, trafficLight: 'RED',
  filled: 2, expected: 3, demotionReason: null, weakest: 'i1',
  thresholds: { green: 90, yellow: 70, cap: 1.2, absenceDemotes: true },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/me/daily-status')) return { ok: true, json: async () => ({ data: status }) } as any;
    if (url.includes('/me/kpi-indicators')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'i1', kpiTitle: 'Layanan', indicatorName: 'Tiket selesai', unit: 'tiket',
          target: 10, direction: 'HIGHER_BETTER', frequency: 'DAILY', aggregation: 'SUM', weight: 100 },
      ] } }) } as any;
    }
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

describe('Daily Cockpit', () => {
  it('menampilkan warna DAN label teks, bukan warna saja', async () => {
    render(<DailyStatusCard />);
    await waitFor(() => expect(screen.getByText(/Perlu perhatian/i)).toBeTruthy());
    expect(screen.getByText(/64.5/)).toBeTruthy();
  });

  it('checklist menampilkan indikator yang belum diisi', async () => {
    render(<DailyKpiChecklist />);
    await waitFor(() => expect(screen.getByText('Tiket selesai')).toBeTruthy());
    expect(screen.getByText(/Belum diisi/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/daily-cockpit.test.tsx`
Expected: FAIL — cannot resolve `DailyStatusCard`.

- [ ] **Step 3: Write `DailyStatusCard`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, MinusCircle } from 'lucide-react';

type Light = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';

interface Status {
  date: string;
  score: number | null;
  trafficLight: Light;
  filled: number;
  expected: number;
  demotionReason: string | null;
}

const PRESENTATION: Record<Light, { label: string; box: string; icon: typeof CheckCircle2 }> = {
  GREEN: { label: 'Baik — sesuai target', box: 'border-[#a7f3d0] bg-[#ecfdf5]', icon: CheckCircle2 },
  YELLOW: { label: 'Perlu perhatian', box: 'border-[#fde68a] bg-[#fffbeb]', icon: AlertTriangle },
  RED: { label: 'Perlu tindakan hari ini', box: 'border-[#fecaca] bg-[#fef2f2]', icon: AlertTriangle },
  NO_DATA: { label: 'Belum ada data hari ini', box: 'border-[#e2e8f0] bg-[#f8fafc]', icon: MinusCircle },
};

export default function DailyStatusCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/me/daily-status')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('gagal'))))
      .then((j) => { if (active) setStatus(j.data); })
      .catch(() => { if (active) setError('Status harian belum dapat dimuat.'); })
      .finally(() => { /* biarkan kartu kosong */ });
    return () => { active = false; };
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#64748b]">
        {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#64748b]">
        Memuat status hari ini…
      </div>
    );
  }

  const p = PRESENTATION[status.trafficLight];
  const Icon = p.icon;

  return (
    <section className={`rounded-2xl border p-4 ${p.box}`} aria-labelledby="daily-status-heading">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 text-[#0f172a]" aria-hidden="true" />
        <div className="flex-1">
          <h2 id="daily-status-heading" className="text-sm font-extrabold text-[#0f172a]">
            Status Kinerja Hari Ini
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#0f172a]">{p.label}</p>
          <p className="mt-1 text-xs text-[#475569]">
            DPI {status.score === null ? '—' : status.score.toFixed(1)} dari 100
            {' · '}
            {status.filled} dari {status.expected} indikator terisi
          </p>
          {status.demotionReason === 'ABSENT_WITHOUT_NOTICE' && (
            <p className="mt-1 text-xs font-semibold text-[#b91c1c]">
              Status diturunkan satu tingkat karena tidak ada keterangan kehadiran.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write `DailyKpiChecklist`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

interface Indicator {
  id: string;
  kpiTitle: string;
  indicatorName: string;
  unit: string;
  target: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  weight: number;
}

interface Entry {
  id: string;
  indicatorId: string;
  actualValue: number;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default function DailyKpiChecklist() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const day = today();
    const [i, e] = await Promise.all([
      fetch('/api/v1/me/kpi-indicators').then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/v1/me/kpi-daily-entries?from=${day}&to=${day}`).then((r) => (r.ok ? r.json() : null)),
    ]);
    setIndicators(i?.data?.items ?? []);
    const map: Record<string, Entry> = {};
    for (const row of e?.data?.items ?? []) map[row.indicatorId] = row;
    setEntries(map);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (indicatorId: string) => {
    const raw = values[indicatorId];
    if (raw === undefined || raw === '') {
      setMessage('Isi nilai realisasi terlebih dahulu.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/v1/me/kpi-daily-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        indicatorId, entryDate: today(), actualValue: Number(raw), submit: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal mengirim realisasi.'); return; }
    setMessage('Realisasi terkirim.');
    await load();
  };

  if (indicators.length === 0) {
    return (
      <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <h2 className="text-sm font-extrabold text-[#0f172a]">KPI Hari Ini</h2>
        <p className="mt-2 text-xs text-[#64748b]">
          Belum ada indikator harian. Hubungi atasan Anda untuk menetapkan indikator pada KPI periode ini.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">KPI Hari Ini</h2>
      <p className="mt-0.5 text-[11px] text-[#64748b]">Isi realisasi tiap indikator, lalu kirim.</p>

      <ul className="mt-3 space-y-3">
        {indicators.map((ind) => {
          const entry = entries[ind.id];
          const done = entry?.status === 'SUBMITTED' || entry?.status === 'VERIFIED';
          return (
            <li key={ind.id} className="rounded-xl border border-[#e2e8f0] p-3">
              <div className="flex items-start gap-2">
                {done
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#007a5a]" aria-hidden="true" />
                  : <CircleDashed className="mt-0.5 h-4 w-4 text-[#94a3b8]" aria-hidden="true" />}
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#0f172a]">{ind.indicatorName}</p>
                  <p className="text-[11px] text-[#64748b]">
                    {ind.kpiTitle} · target {ind.target} {ind.unit}
                    {ind.direction === 'LOWER_BETTER' ? ' (semakin kecil semakin baik)' : ''}
                  </p>

                  {done ? (
                    <p className="mt-1 text-xs font-semibold text-[#007a5a]">
                      Terkirim: {entry.actualValue} {ind.unit}
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={`Realisasi ${ind.indicatorName}`}
                        value={values[ind.id] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [ind.id]: e.target.value }))}
                        className="w-24 rounded-lg border border-[#cbd5e1] px-2 py-1 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                        placeholder="0"
                      />
                      <span className="text-[11px] text-[#64748b]">{ind.unit}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => submit(ind.id)}
                        className="rounded-lg bg-[#007a5a] px-3 py-1 text-xs font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
                      >
                        Kirim
                      </button>
                    </div>
                  )}

                  {!done && entry?.status === 'DRAFT' && (
                    <p className="mt-1 text-[11px] text-[#b45309]">Draf tersimpan, belum dikirim.</p>
                  )}
                  {entry?.status === 'REJECTED' && (
                    <p className="mt-1 text-[11px] font-semibold text-[#b91c1c]">
                      Ditolak atasan — perbaiki lalu kirim ulang.
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {message && <p className="mt-3 text-xs font-semibold text-[#0f172a]">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 5: Write `PerformanceRecapTabs`**

```tsx
'use client';

import { useEffect, useState } from 'react';

type Period = 'daily' | 'monthly' | 'yearly';

interface Recap {
  periodMonth: string;
  daysGreen: number;
  daysYellow: number;
  daysRed: number;
  daysNoData: number;
  avgDpi: number | null;
  entryAdherence: number | null;
}

const LABEL: Record<Period, string> = { daily: 'Harian', monthly: 'Bulanan', yearly: 'Tahunan' };

export default function PerformanceRecapTabs() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [recap, setRecap] = useState<Recap | null>(null);

  useEffect(() => {
    let active = true;
    setRecap(null);
    fetch(`/api/v1/me/performance-recap?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setRecap(j?.data ?? null); })
      .catch(() => { /* biarkan kosong */ });
    return () => { active = false; };
  }, [period]);

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-[#0f172a]">Rekap Kinerja</h2>
        <div role="tablist" aria-label="Periode rekap" className="flex gap-1">
          {(Object.keys(LABEL) as Period[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] ${
                period === p ? 'bg-[#007a5a] text-white' : 'bg-[#f1f5f9] text-[#475569]'
              }`}
            >
              {LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {!recap ? (
        <p className="mt-2 text-xs text-[#64748b]">Memuat rekap…</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div><dt className="text-[#64748b]">Rata-rata DPI</dt><dd className="text-base font-extrabold text-[#0f172a]">{recap.avgDpi ?? '—'}</dd></div>
          <div><dt className="text-[#64748b]">Hari Hijau</dt><dd className="text-base font-extrabold text-[#0f172a]">{recap.daysGreen}</dd></div>
          <div><dt className="text-[#64748b]">Hari Kuning</dt><dd className="text-base font-extrabold text-[#0f172a]">{recap.daysYellow}</dd></div>
          <div><dt className="text-[#64748b]">Hari Merah</dt><dd className="text-base font-extrabold text-[#0f172a]">{recap.daysRed}</dd></div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-[#64748b]">Kepatuhan pengisian</dt>
            <dd className="text-base font-extrabold text-[#0f172a]">
              {recap.entryAdherence === null ? '—' : `${Math.round(recap.entryAdherence * 100)}%`}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Mount the cockpit in the employee portal**

In `src/app/dashboard/employee-portal/page.tsx`, add imports next to the other employee imports:

```tsx
import DailyStatusCard from '@/components/employee/DailyStatusCard';
import DailyKpiChecklist from '@/components/employee/DailyKpiChecklist';
import PerformanceRecapTabs from '@/components/employee/PerformanceRecapTabs';
```

Then, inside the `DURING` phase block, immediately after the opening fragment:

```tsx
  {/* ==== FASE: Saat Kerja ==== */}
  {activePhase === 'DURING' && (
    <>
  {/* 1. Daily Cockpit (PRD v2 §7.5) */}
  <div className="grid gap-3 lg:grid-cols-2">
    <DailyStatusCard />
    <DailyKpiChecklist />
  </div>
  <PerformanceRecapTabs />
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/ui/daily-cockpit.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/employee/DailyStatusCard.tsx src/components/employee/DailyKpiChecklist.tsx src/components/employee/PerformanceRecapTabs.tsx src/app/dashboard/employee-portal/page.tsx tests/ui/daily-cockpit.test.tsx
git commit -m "feat(ui): Employee Daily Cockpit — status, checklist KPI, rekap (PRD v2 fase 1)"
```

---

### Task 10: Supervisor verification queue and DPI distribution

**Files:**
- Create: `src/components/governance/DailyVerificationPanel.tsx`
- Modify: `src/app/dashboard/manager-cockpit/page.tsx` (mount the panel)
- Test: `tests/ui/daily-verification.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/performance/daily-status/team`, `GET /api/v1/me/kpi-daily-entries` (supervisor view uses the employee query param added below), `PUT /api/v1/performance/kpi-daily-entries/:id/verify`.

- [ ] **Step 1: Extend the entries route for supervisors**

In `src/app/api/v1/me/kpi-daily-entries/route.ts`, replace the `GET` body with:

```ts
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:read');

    const today = isoDay();
    const from = req.nextUrl.searchParams.get('from') ?? today;
    const to = req.nextUrl.searchParams.get('to') ?? today;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(from) || !dateRe.test(to)) {
      return fail('VALIDATION_ERROR', 'Format tanggal harus YYYY-MM-DD.', 400);
    }

    // `employeeId` hanya boleh dipakai pengawas; karyawan selalu membaca miliknya.
    const requested = req.nextUrl.searchParams.get('employeeId');
    let target = session.employeeId;
    if (requested && requested !== session.employeeId) {
      assertCan(session, 'kpi:approve');
      target = requested;
    }
    if (!target) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const items = await listEntries(db, target, from, to);
    return ok({ items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat entri harian', status);
  }
}
```

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DailyVerificationPanel from '@/components/governance/DailyVerificationPanel';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/performance/daily-status/team')) {
      return { ok: true, json: async () => ({ data: { date: '2026-10-21', items: [
        { employeeId: 'b4', date: '2026-10-21', score: 55, trafficLight: 'RED', filled: 1, expected: 3, demotionReason: null },
      ] } }) } as any;
    }
    if (url.includes('/kpi-daily-entries')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'e1', indicatorId: 'i1', entryDate: '2026-10-21', actualValue: 5, status: 'SUBMITTED', isLate: false },
      ] } }) } as any;
    }
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

describe('DailyVerificationPanel', () => {
  it('menampilkan bawahan berstatus merah dengan label teks', async () => {
    render(<DailyVerificationPanel />);
    await waitFor(() => expect(screen.getByText(/Perlu tindakan/i)).toBeTruthy());
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/ui/daily-verification.test.tsx`
Expected: FAIL — cannot resolve `DailyVerificationPanel`.

- [ ] **Step 4: Write the component**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

interface TeamStatus {
  employeeId: string;
  date: string;
  score: number | null;
  trafficLight: 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';
  filled: number;
  expected: number;
  demotionReason: string | null;
}

interface Entry {
  id: string;
  entryDate: string;
  actualValue: number;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  isLate: boolean;
}

const LIGHT_LABEL: Record<TeamStatus['trafficLight'], string> = {
  GREEN: 'Baik',
  YELLOW: 'Perlu perhatian',
  RED: 'Perlu tindakan',
  NO_DATA: 'Belum ada data',
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default function DailyVerificationPanel() {
  const [team, setTeam] = useState<TeamStatus[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    const res = await fetch(`/api/v1/performance/daily-status/team?date=${today()}`);
    if (!res.ok) return;
    const json = await res.json();
    setTeam(json?.data?.items ?? []);
  }, []);

  useEffect(() => { void loadTeam(); }, [loadTeam]);

  const loadEntries = useCallback(async (employeeId: string) => {
    setSelected(employeeId);
    const day = today();
    const res = await fetch(
      `/api/v1/me/kpi-daily-entries?from=${day}&to=${day}&employeeId=${employeeId}`,
    );
    if (!res.ok) { setEntries([]); return; }
    const json = await res.json();
    setEntries(json?.data?.items ?? []);
  }, []);

  const decide = async (entryId: string, decision: 'VERIFIED' | 'REJECTED') => {
    setMessage(null);
    const body: Record<string, unknown> = { decision };
    if (decision === 'REJECTED') {
      const reason = window.prompt('Alasan penolakan (wajib):') ?? '';
      if (reason.trim().length < 5) { setMessage('Alasan penolakan minimal 5 karakter.'); return; }
      body.reason = reason;
    }
    const res = await fetch(`/api/v1/performance/kpi-daily-entries/${entryId}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal menyimpan keputusan.'); return; }
    setMessage('Keputusan tersimpan.');
    if (selected) await loadEntries(selected);
    await loadTeam();
  };

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Verifikasi Kinerja Harian Tim</h2>
      <p className="mt-0.5 text-[11px] text-[#64748b]">
        Status hari ini per bawahan. Klik nama untuk meninjau entri yang menunggu.
      </p>

      <ul className="mt-3 divide-y divide-[#e2e8f0]">
        {team.map((row) => (
          <li key={row.employeeId} className="py-2">
            <button
              type="button"
              onClick={() => loadEntries(row.employeeId)}
              className="flex w-full items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              <span className="text-xs font-semibold text-[#0f172a]">{row.employeeId.slice(0, 8)}…</span>
              <span className="text-[11px] font-bold text-[#0f172a]">
                {LIGHT_LABEL[row.trafficLight]} · DPI {row.score ?? '—'} · {row.filled}/{row.expected}
              </span>
            </button>
          </li>
        ))}
        {team.length === 0 && (
          <li className="py-2 text-xs text-[#64748b]">Belum ada snapshot tim untuk hari ini.</li>
        )}
      </ul>

      {selected && (
        <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
          <p className="text-xs font-bold text-[#0f172a]">Entri menunggu verifikasi</p>
          <ul className="mt-2 space-y-2">
            {entries.filter((e) => e.status === 'SUBMITTED').map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#0f172a]">
                  {e.entryDate} · nilai {e.actualValue}{e.isLate ? ' · terlambat' : ''}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => decide(e.id, 'VERIFIED')}
                    className="rounded-lg bg-[#007a5a] p-1.5 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
                    aria-label={`Setujui entri ${e.entryDate}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(e.id, 'REJECTED')}
                    className="rounded-lg bg-[#b91c1c] p-1.5 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c] focus-visible:ring-offset-2"
                    aria-label={`Tolak entri ${e.entryDate}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
            {entries.filter((e) => e.status === 'SUBMITTED').length === 0 && (
              <li className="text-xs text-[#64748b]">Tidak ada entri yang menunggu.</li>
            )}
          </ul>
        </div>
      )}

      {message && <p className="mt-3 text-xs font-semibold text-[#0f172a]">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 5: Mount it in the manager cockpit**

In `src/app/dashboard/manager-cockpit/page.tsx`, add the import and render it above the existing panels:

```tsx
import DailyVerificationPanel from '@/components/governance/DailyVerificationPanel';
```

```tsx
<DailyVerificationPanel />
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/ui/daily-verification.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the whole suite for regressions**

Run: `npx vitest run`
Expected: all previously passing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/governance/DailyVerificationPanel.tsx src/app/dashboard/manager-cockpit/page.tsx src/app/api/v1/me/kpi-daily-entries/route.ts tests/ui/daily-verification.test.tsx
git commit -m "feat(manager): antrean verifikasi harian + status tim (PRD v2 fase 1)"
```

---

### Task 11: Attendance work mode and correction requests

**Files:**
- Create: `src/lib/db/migrations/0042_attendance_corrections.sql`
- Create: `src/lib/services/attendanceCorrectionService.ts`
- Create: `src/app/api/v1/me/attendance-corrections/route.ts`
- Create: `src/app/api/v1/attendance/corrections/[id]/decide/route.ts`
- Modify: `src/lib/auth/rbac.ts` (add `attendance:correct`)
- Test: `tests/api/attendance-corrections-routes.test.ts`

**Interfaces:**
- Produces:
  - `requestCorrection(db, input: { attendanceLogId, employeeId, requestedCheckInAt?, requestedCheckOutAt?, reason }): Promise<CorrectionRow>`
  - `decideCorrection(db, input: { id, deciderId, decision: 'APPROVED' | 'REJECTED', note? }): Promise<CorrectionRow>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as postCorrection } from '@/app/api/v1/me/attendance-corrections/route';
import { PUT as putDecide } from '@/app/api/v1/attendance/corrections/[id]/decide/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('attendance corrections', () => {
  let client: PGlite;
  let db: any;
  let empCookie = '';
  let hrCookie = '';
  let logId = '';
  let correctionId = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    const log = await db.execute(`
      INSERT INTO attendance_logs (employee_id, work_date, check_in_at, work_mode)
      VALUES ('${BUDI}', CURRENT_DATE, CURRENT_TIMESTAMP - INTERVAL '1 hour', 'WFH')
      ON CONFLICT (employee_id, work_date) DO UPDATE SET work_mode = 'WFH'
      RETURNING id`);
    logId = log.rows[0].id;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });
  afterAll(async () => { await client.close(); });

  it('menolak koreksi tanpa jam pengganti', async () => {
    const res = await postCorrection(jsonReq('/api/v1/me/attendance-corrections', 'POST', {
      attendanceLogId: logId, reason: 'mesin absen error',
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('mengajukan koreksi jam masuk', async () => {
    const res = await postCorrection(jsonReq('/api/v1/me/attendance-corrections', 'POST', {
      attendanceLogId: logId, requestedCheckInAt: '2026-10-21T07:55:00+07:00', reason: 'mesin absen error',
    }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('SUBMITTED');
    correctionId = json.data.id;
  });

  it('data mesin asli tidak berubah sebelum disetujui', async () => {
    const before = await db.execute(`SELECT check_in_at FROM attendance_logs WHERE id = '${logId}'`);
    expect(before.rows[0].check_in_at).not.toBeNull();
    const mode = await db.execute(`SELECT work_mode FROM attendance_logs WHERE id = '${logId}'`);
    expect(mode.rows[0].work_mode).toBe('WFH');
  });

  it('HR menyetujui koreksi dan jam diterapkan', async () => {
    const res = await putDecide(
      jsonReq(`/api/v1/attendance/corrections/${correctionId}/decide`, 'PUT', { decision: 'APPROVED', note: 'sesuai log mesin' }, hrCookie),
      { params: { id: correctionId } } as any,
    );
    expect(res.status).toBe(200);

    const after = await db.execute(`SELECT check_in_at FROM attendance_logs WHERE id = '${logId}'`);
    const applied = new Date(after.rows[0].check_in_at).toISOString();
    expect(applied.startsWith('2026-10-21T00:55')).toBe(true); // 07:55+07:00 == 00:55Z
  });

  it('keputusan kedua ditolak', async () => {
    const res = await putDecide(
      jsonReq(`/api/v1/attendance/corrections/${correctionId}/decide`, 'PUT', { decision: 'REJECTED' }, hrCookie),
      { params: { id: correctionId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/attendance-corrections-routes.test.ts`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Write the migration**

```sql
-- 0042: Mode kerja & koreksi absensi (PRD v2.0 §5.5, §10.3 H).
CREATE TYPE work_mode_enum AS ENUM ('WFO', 'WFH', 'FIELD_DUTY');
CREATE TYPE correction_status_enum AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS work_mode work_mode_enum NOT NULL DEFAULT 'WFO';

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id UUID NOT NULL REFERENCES attendance_logs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_check_in_at TIMESTAMPTZ,
  requested_check_out_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status correction_status_enum NOT NULL DEFAULT 'SUBMITTED',
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (requested_check_in_at IS NOT NULL OR requested_check_out_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_pending
  ON attendance_corrections (status, created_at) WHERE status = 'SUBMITTED';
```

- [ ] **Step 4: Add the permission**

```ts
| 'attendance:correct'
```

```ts
'attendance:correct': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
```

- [ ] **Step 5: Write the service**

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export interface CorrectionRow {
  id: string;
  attendanceLogId: string;
  employeeId: string;
  requestedCheckInAt: string | null;
  requestedCheckOutAt: string | null;
  reason: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  decisionNote: string | null;
}

const SELECT = sql`
  id, attendance_log_id AS "attendanceLogId", employee_id AS "employeeId",
  requested_check_in_at AS "requestedCheckInAt",
  requested_check_out_at AS "requestedCheckOutAt",
  reason, status, decision_note AS "decisionNote"
`;

export async function requestCorrection(
  db: Db,
  input: {
    attendanceLogId: string;
    employeeId: string;
    requestedCheckInAt?: string;
    requestedCheckOutAt?: string;
    reason: string;
  },
): Promise<CorrectionRow> {
  if (!input.requestedCheckInAt && !input.requestedCheckOutAt) {
    throw new BusinessRuleError('Isi minimal satu jam pengganti (masuk atau keluar).');
  }
  if (input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan koreksi wajib diisi (minimal 5 karakter).');
  }

  const owned = (await db.execute(sql`
    SELECT 1 FROM attendance_logs
     WHERE id = ${input.attendanceLogId}::uuid AND employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: unknown[] };
  if (!owned.rows?.length) {
    throw new BusinessRuleError('Log absensi tidak ditemukan untuk karyawan ini.');
  }

  const res = (await db.execute(sql`
    INSERT INTO attendance_corrections
      (attendance_log_id, employee_id, requested_check_in_at, requested_check_out_at, reason)
    VALUES (${input.attendanceLogId}::uuid, ${input.employeeId}::uuid,
            ${input.requestedCheckInAt ?? null}::timestamptz,
            ${input.requestedCheckOutAt ?? null}::timestamptz, ${input.reason})
    RETURNING ${SELECT}
  `)) as unknown as { rows: CorrectionRow[] };
  return res.rows[0];
}

export async function decideCorrection(
  db: Db,
  input: { id: string; deciderId: string; decision: 'APPROVED' | 'REJECTED'; note?: string },
): Promise<CorrectionRow> {
  const current = (await db.execute(sql`
    SELECT status, attendance_log_id AS "attendanceLogId",
           requested_check_in_at AS "requestedCheckInAt",
           requested_check_out_at AS "requestedCheckOutAt"
      FROM attendance_corrections WHERE id = ${input.id}::uuid
  `)) as unknown as {
    rows: Array<{
      status: string; attendanceLogId: string;
      requestedCheckInAt: string | null; requestedCheckOutAt: string | null;
    }>;
  };

  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Pengajuan koreksi tidak ditemukan.');
  if (row.status !== 'SUBMITTED') {
    throw new BusinessRuleError(`Koreksi sudah diputuskan (${row.status}).`);
  }

  if (input.decision === 'APPROVED') {
    await db.execute(sql`
      UPDATE attendance_logs
         SET check_in_at = COALESCE(${row.requestedCheckInAt ?? null}::timestamptz, check_in_at),
             check_out_at = COALESCE(${row.requestedCheckOutAt ?? null}::timestamptz, check_out_at),
             approved_by = ${input.deciderId}::uuid,
             approved_at = CURRENT_TIMESTAMP
       WHERE id = ${row.attendanceLogId}::uuid
    `);
  }

  const res = (await db.execute(sql`
    UPDATE attendance_corrections
       SET status = ${input.decision}::correction_status_enum,
           decided_by = ${input.deciderId}::uuid,
           decided_at = CURRENT_TIMESTAMP,
           decision_note = ${input.note ?? null}
     WHERE id = ${input.id}::uuid
    RETURNING ${SELECT}
  `)) as unknown as { rows: CorrectionRow[] };
  return res.rows[0];
}
```

- [ ] **Step 6: Write the two routes**

`src/app/api/v1/me/attendance-corrections/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { requestCorrection } from '@/lib/services/attendanceCorrectionService';

const BodySchema = z
  .object({
    attendanceLogId: z.string().uuid(),
    requestedCheckInAt: z.string().datetime({ offset: true }).optional(),
    requestedCheckOutAt: z.string().datetime({ offset: true }).optional(),
    reason: z.string().min(5).max(500),
  })
  .refine((v) => v.requestedCheckInAt || v.requestedCheckOutAt, {
    message: 'Isi minimal satu jam pengganti (masuk atau keluar).',
  });

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await requestCorrection(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, 'Koreksi absensi terkirim dan menunggu keputusan HRD.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengajukan koreksi', status);
  }
}
```

`src/app/api/v1/attendance/corrections/[id]/decide/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { decideCorrection } from '@/lib/services/attendanceCorrectionService';

const BodySchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(500).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:correct');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Keputusan tidak valid.', 400);

    const row = await decideCorrection(db, {
      id: params.id, deciderId: session.userId,
      decision: parsed.data.decision, note: parsed.data.note,
    });
    return ok(row, 'Keputusan koreksi tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memutuskan koreksi', status);
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/api/attendance-corrections-routes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/migrations/0042_attendance_corrections.sql src/lib/services/attendanceCorrectionService.ts src/app/api/v1/me/attendance-corrections "src/app/api/v1/attendance/corrections" src/lib/auth/rbac.ts tests/api/attendance-corrections-routes.test.ts
git commit -m "feat(attendance): mode kerja + koreksi absensi (PRD v2 fase 1)"
```

---

## Phase 1 completion checklist

- [ ] `npx vitest run` green.
- [ ] `npm run build` succeeds.
- [ ] Migrations `0038`–`0042` apply cleanly on a fresh PGlite (`npm run db:reset`) and on PostgreSQL (`npm run db:migrate:pg`).
- [ ] PRD §8 acceptance criteria for Status Kepegawaian, Input KPI Harian, DPI & Kotak Status, and Rollup Periode each map to a passing test above.
- [ ] Attendance correction never overwrites machine data before approval (asserted in Task 11).
- [ ] No `RESTRICTED` field appears in `activity_events` (enforced by the test in Task 2).
