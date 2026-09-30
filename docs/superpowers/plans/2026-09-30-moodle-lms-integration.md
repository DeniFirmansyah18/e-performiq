# Moodle LMS Model Integration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt Moodle's LMS model (course completion tracking, competency framework + evidence, badges, learning plans) natively into E-PerformIQ, mapped to the Pre/During/Post employee lifecycle, and let training/competency feed the GPA Competency component (DUR-03).

**Architecture:** New DB tables (migration 0009) model Moodle concepts; pure engines implement Moodle's completion/evidence/badge/criteria rules; services + an idempotent observer orchestrate course completion - competency evidence - badge award; routes expose them under `/api/v1/learning/*`; the employee portal and HR command center gain a Learning module. GPA impact is achieved by the caller computing its `competencyScore` input from LMS data - `calculateCompositeGPA` itself is unchanged (backward-compatible).

**Tech Stack:** Next.js 14, React 18, TypeScript, Drizzle ORM over PGlite, Vitest, Tailwind, `zod`, existing `ok/fail` + RFC7807 + `assertCan` + `scope.ts`.

**Spec:** `docs/superpowers/specs/2026-09-30-moodle-lms-integration-design.md`

## Global Constraints

- Migrations idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, ENUM via `DO $$ ... EXCEPTION WHEN duplicate_object`); numbered `0009_...`. Track in `__migrations`; run `npm run db:migrate`.
- Responses: `ok(data, message?)` / `fail(code, message, status)` from `src/lib/api/response.ts`; thrown domain errors - `problem(err, instance)` (RFC 7807).
- RBAC: protected routes call `assertCan(session, permission)` from `src/lib/auth/rbac.ts`; employee-scoped access uses `resolveVisibleEmployeeIds` + `assertEmployeeVisible` from `src/lib/auth/scope.ts`.
- GPA weights are fixed 50/20/15/15 (PRD -3.2). `calculateCompositeGPA(req)` keeps its exact signature; LMS only changes what a caller passes as `competencyScore`.
- Tests: unit tests avoid DB; integration tests use `createTestDb()` from `tests/setup.ts`. Never touch `.pglite/` in tests.
- Worktree test command: `.\node_modules\.bin\vitest.cmd run <path>` (npx resolves a broken vitest@5). Build: `npm run build`.
- All seed INSERTs `ON CONFLICT DO NOTHING`. Observer must be idempotent.

## Review Focus

Inputs/conditions the spec implies but no single task's happy path covers - each has a test in its owning task:

1. **Re-completing a course** must not duplicate evidence rows or double-award a badge. (Task 12)
2. **Zero/empty data** - no courses, no criteria, no evidence - engines return empty/0, routes null-safe, GPA falls back to the provided score. (Task 4, Task 6, Task 7, Task 9)
3. **Out-of-scope access** - an EMPLOYEE requesting another employee's competency profile / learning plan - 403. (Task 10)
4. **Badge ALL vs ANY criteria** - a COURSESET badge with multiple courses must award only when the rule is satisfied. (Task 7)
5. **Course with zero activities** - `computeCourseProgress` must not divide by zero. (Task 4)

---

## WS-1 - Schema & Seed

### Task 1: Migration 0009 + extended enrollment columns

**Files:**
- Create: `src/lib/db/migrations/0009_moodle_lms.sql`
- Modify: `tests/integration/schema.test.ts` (expected table list + count 38 - 47)
- Test: `tests/integration/govera-0009-schema.test.ts` (new)

**Interfaces:**
- Consumes: `runMigrations`, `createTestDb()`.
- Produces: 9 new tables + 3 new columns on `moodle_course_enrollments`.

- [ ] **Step 1: Write the failing schema test**

Create `tests/integration/govera-0009-schema.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

const NEW_TABLES = [
  'competency_frameworks', 'competencies', 'moodle_courses', 'course_competencies',
  'competency_evidence', 'badges', 'badge_criteria', 'badge_awards',
  'learning_plans', 'learning_plan_items',
];

describe('migration 0009: Moodle LMS tables', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); });
  afterAll(async () => { await client.close(); });

  it('membuat seluruh tabel LMS', async () => {
    for (const t of NEW_TABLES) {
      const r = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT FROM information_schema.tables
          WHERE table_schema='public' AND table_name=$1) AS exists`, [t]);
      expect(r.rows[0].exists, `missing ${t}`).toBe(true);
    }
  });

  it('menambah kolom completion_state, time_spent_minutes, last_activity_at pada moodle_course_enrollments', async () => {
    const r = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name='moodle_course_enrollments'`);
    const cols = r.rows.map((x) => x.column_name);
    expect(cols).toEqual(expect.arrayContaining(['completion_state', 'time_spent_minutes', 'last_activity_at']));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/govera-0009-schema.test.ts`
Expected: FAIL - relations/columns do not exist.

- [ ] **Step 3: Create the migration (idempotent)**

Create `src/lib/db/migrations/0009_moodle_lms.sql` with idempotent ENUM creation and all tables. ENUMs:
`course_phase_enum('PRE','DURING','POST')`, `completion_state_enum('NOT_STARTED','IN_PROGRESS','COMPLETE')`,
`competency_outcome_enum('COMPLETE','EVIDENCE','RECOMMEND','NONE')`,
`evidence_source_enum('COURSE','ACTIVITY','MANUAL')`, `evidence_action_enum('COMPLETE','LOG','RECOMMEND')`,
`badge_type_enum('COURSE','COMPETENCY','PHASE')`, `badge_criteria_type_enum('COURSE','COMPETENCY','COURSESET')`,
`plan_status_enum('DRAFT','ACTIVE','COMPLETE')`, `plan_item_status_enum('TODO','IN_PROGRESS','DONE')`.
Wrap each `CREATE TYPE` in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
Then `CREATE TABLE IF NOT EXISTS` for the 10 tables declared in the spec -3 WS-1, with the FKs and
`UNIQUE(badge_id, employee_id)` on `badge_awards`. Finally:
```sql
ALTER TABLE moodle_course_enrollments ADD COLUMN IF NOT EXISTS completion_state completion_state_enum DEFAULT 'NOT_STARTED';
ALTER TABLE moodle_course_enrollments ADD COLUMN IF NOT EXISTS time_spent_minutes INT DEFAULT 0;
ALTER TABLE moodle_course_enrollments ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
```

- [ ] **Step 4: Verify the schema test passes**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/govera-0009-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `tests/integration/schema.test.ts`**

Add the 9 new tables (the 10th, `learning_plan_items`, plus the rest) to `EXPECTED_TABLES` alphabetically
and change the count/description from 38 to **47** (24 PRD + 7 Govera + 4 Kotak3 + 3 ref + 9 LMS; note the
0009 table list has 10 names, one of which - verify against WS-1 - is included; set the number to match the
actual count returned and update the test title accordingly).

- [ ] **Step 6: Run schema tests + commit**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/schema.test.ts tests/integration/govera-0009-schema.test.ts`
Expected: PASS. Then:
```bash
git add -A
git commit -m "feat(lms): migration 0009 - Moodle model tables + enrollment columns"
```

---

### Task 2: Seed LMS reference data

**Files:**
- Modify: `src/lib/db/seed/index.ts` (append after the policy KB block, before the closing `` `); ``)
- Test: `tests/integration/lms-seed.test.ts` (new)

**Interfaces:**
- Consumes: migration 0009 tables.
- Produces: seeded frameworks, competencies, courses, course_competencies, badges, badge_criteria,
  one learning plan + items, and sample enrollments.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lms-seed.test.ts` asserting (after `createTestDb()` + `runSeed`):
`competency_frameworks` - 2, `competencies` - 6, `moodle_courses` - 6 with at least one course per
phase (PRE/DURING/POST), `badges` - 2, `badge_criteria` - 2, `learning_plans` - 1, and idempotency
(run `runSeed` twice - counts unchanged).

- [ ] **Step 2: Run to verify failure**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/lms-seed.test.ts`
Expected: FAIL - counts are 0.

- [ ] **Step 3: Add the seed block**

Append an idempotent INSERT block (all `ON CONFLICT DO NOTHING`) seeding:
- frameworks: `AKHLAK` (code `FW-AKHLAK`), `Cloud Engineering` (code `FW-CLOUD`).
- competencies: 8 rows across the two frameworks (e.g. Amanah, Kompeten, Cloud Native Architecture,
  PostgreSQL, System Design, Leadership, Cross-Functional Collaboration, Security Foundations).
- courses: 6 rows - `ONB-101` (PRE, mandatory), `AKHLAK-CULTURE` (PRE, mandatory),
  `CLOUD-ARCH` (DURING), `PG-ADV` (DURING), `LEAD-ESS` (DURING), `LEGACY-ALUMNI` (POST). Each with
  `course_code` unique, `default_hours`.
- course_competencies linking e.g. `CLOUD-ARCH`-Cloud Native Architecture (COMPLETE), `PG-ADV`-PostgreSQL (EVIDENCE).
- badges: `BADGE-ONBOARD` (PHASE), `BADGE-CLOUD-CERT` (COURSE), with `badge_criteria` rows.
- learning_plans: 1 for Budi (`b0000000-0000-4000-8000-000000000004`) + 2 items.
- moodle_course_enrollments: keep existing 3 rows; optionally set `completion_state` on the completed one.

- [ ] **Step 4: Run the seed test**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/lms-seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(lms): seed Moodle-model reference data (frameworks, courses, badges, plans)"
```

---

## WS-2 -- Pure Engines

### Task 3: completion-engine

**Files:**
- Create: `src/lib/engines/completion-engine.ts`
- Test: `tests/unit/completionEngine.test.ts` (new)

**Interfaces:**
- Produces: `computeCourseProgress(items: { completed: boolean }[]): number` (0--100, 0 when empty).
- Produces: `resolveCompletionState(progressPct: number, rule: 'ALL' | 'ANY'): CompletionState`
  where `type CompletionState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/completionEngine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeCourseProgress, resolveCompletionState } from '@/lib/engines/completion-engine';

describe('completion-engine', () => {
  it('menghitung progress sebagai persentase modul selesai', () => {
    expect(computeCourseProgress([{ completed: true }, { completed: false }, { completed: true }, { completed: false }])).toBe(50);
  });
  it('mengembalikan 0 untuk daftar kosong (tidak NaN)', () => {
    expect(computeCourseProgress([])).toBe(0);
  });
  it('menentukan state NOT_STARTED / IN_PROGRESS / COMPLETE', () => {
    expect(resolveCompletionState(0, 'ALL')).toBe('NOT_STARTED');
    expect(resolveCompletionState(50, 'ALL')).toBe('IN_PROGRESS');
    expect(resolveCompletionState(100, 'ALL')).toBe('COMPLETE');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/completionEngine.test.ts`
Expected: FAIL -- module not found.

- [ ] **Step 3: Implement**

```ts
export type CompletionState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';

export function computeCourseProgress(items: { completed: boolean }[]): number {
  if (!items || items.length === 0) return 0;
  const done = items.filter((i) => i.completed).length;
  return Number(((done / items.length) * 100).toFixed(2));
}

export function resolveCompletionState(progressPct: number, _rule: 'ALL' | 'ANY' = 'ALL'): CompletionState {
  if (progressPct <= 0) return 'NOT_STARTED';
  if (progressPct >= 100) return 'COMPLETE';
  return 'IN_PROGRESS';
}
```

- [ ] **Step 4: Verify PASS, then commit**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/completionEngine.test.ts` --- PASS.
```bash
git add -A; git commit -m "feat(lms): completion engine (progress + state)"
```

---

### Task 4: competency-evidence-engine

**Files:**
- Create: `src/lib/engines/competency-evidence-engine.ts`
- Test: `tests/unit/competencyEvidenceEngine.test.ts` (new)

**Interfaces:**
- Produces: `deriveCompetencyRating(evidence: { rating: number }[]): number` (rounded average 1--5; 0 when empty).
- Produces: `computeSkillGap(required: number, actual: number): { gap: number; deficient: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { deriveCompetencyRating, computeSkillGap } from '@/lib/engines/competency-evidence-engine';

describe('competency-evidence-engine', () => {
  it('merata-ratakan rating evidence (dibulatkan, clamp 1..5)', () => {
    expect(deriveCompetencyRating([{ rating: 4 }, { rating: 5 }])).toBe(5);
    expect(deriveCompetencyRating([{ rating: 3 }, { rating: 3 }])).toBe(3);
    expect(deriveCompetencyRating([{ rating: 9 }])).toBe(5);
  });
  it('mengembalikan 0 untuk evidence kosong', () => {
    expect(deriveCompetencyRating([])).toBe(0);
  });
  it('menghitung gap dan status deficient', () => {
    expect(computeSkillGap(4, 3)).toEqual({ gap: 1, deficient: true });
    expect(computeSkillGap(3, 4)).toEqual({ gap: -1, deficient: false });
  });
});
```

- [ ] **Step 2: Run to verify failure** --- `.\node_modules\.bin\vitest.cmd run tests/unit/competencyEvidenceEngine.test.ts` --- FAIL.

- [ ] **Step 3: Implement**

```ts
export function deriveCompetencyRating(evidence: { rating: number }[]): number {
  if (!evidence || evidence.length === 0) return 0;
  const avg = evidence.reduce((s, e) => s + e.rating, 0) / evidence.length;
  return Math.min(5, Math.max(1, Math.round(avg)));
}

export function computeSkillGap(required: number, actual: number): { gap: number; deficient: boolean } {
  const gap = required - actual;
  return { gap, deficient: gap > 0 };
}
```

- [ ] **Step 4: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): competency evidence engine (rating + skill gap)"
```

---

### Task 5: badge-award-engine

**Files:**
- Create: `src/lib/engines/badge-award-engine.ts`
- Test: `tests/unit/badgeAwardEngine.test.ts` (new)

**Interfaces:**
- Produces: `evaluateBadgeCriteria(criteria: BadgeCriterion[], ctx: BadgeContext): boolean`
  - `type BadgeCriterion = { criteriaType: 'COURSE' | 'COMPETENCY' | 'COURSESET'; courseId?: number; competencyId?: string; minLevel?: number }`
  - `type BadgeContext = { completedCourseIds: number[]; competencyLevels: Record<string, number> }`
  - COURSE: courseId --- completedCourseIds. COMPETENCY: competencyLevels[competencyId] >= minLevel.
    Empty criteria --- false; rule is ALL (every criterion must hold).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { evaluateBadgeCriteria } from '@/lib/engines/badge-award-engine';

describe('badge-award-engine', () => {
  const ctx = { completedCourseIds: [101, 102], competencyLevels: { 'c-cloud': 4 } };
  it('COURSE terpenuhi bila course selesai', () => {
    expect(evaluateBadgeCriteria([{ criteriaType: 'COURSE', courseId: 101 }], ctx)).toBe(true);
    expect(evaluateBadgeCriteria([{ criteriaType: 'COURSE', courseId: 999 }], ctx)).toBe(false);
  });
  it('COMPETENCY terpenuhi bila level >= minLevel', () => {
    expect(evaluateBadgeCriteria([{ criteriaType: 'COMPETENCY', competencyId: 'c-cloud', minLevel: 3 }], ctx)).toBe(true);
    expect(evaluateBadgeCriteria([{ criteriaType: 'COMPETENCY', competencyId: 'c-cloud', minLevel: 5 }], ctx)).toBe(false);
  });
  it('COURSESET butuh SEMUA course', () => {
    expect(evaluateBadgeCriteria([
      { criteriaType: 'COURSE', courseId: 101 }, { criteriaType: 'COURSE', courseId: 102 },
    ], ctx)).toBe(true);
    expect(evaluateBadgeCriteria([
      { criteriaType: 'COURSE', courseId: 101 }, { criteriaType: 'COURSE', courseId: 777 },
    ], ctx)).toBe(false);
  });
  it('kriteria kosong --- false', () => {
    expect(evaluateBadgeCriteria([], ctx)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** --- FAIL.

- [ ] **Step 3: Implement**

```ts
export type BadgeCriterion = {
  criteriaType: 'COURSE' | 'COMPETENCY' | 'COURSESET';
  courseId?: number; competencyId?: string; minLevel?: number;
};
export type BadgeContext = { completedCourseIds: number[]; competencyLevels: Record<string, number> };

export function evaluateBadgeCriteria(criteria: BadgeCriterion[], ctx: BadgeContext): boolean {
  if (!criteria || criteria.length === 0) return false;
  return criteria.every((c) => {
    if (c.criteriaType === 'COURSE') return ctx.completedCourseIds.includes(Number(c.courseId));
    if (c.criteriaType === 'COMPETENCY') return (ctx.competencyLevels[c.competencyId ?? ''] ?? 0) >= (c.minLevel ?? 1);
    return true;
  });
}
```

- [ ] **Step 4: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): badge award criteria engine"
```

---

### Task 6: training-hours-engine

**Files:**
- Create: `src/lib/engines/training-hours-engine.ts`
- Test: `tests/unit/trainingHoursEngine.test.ts` (new)

**Interfaces:**
- Produces: `computeTrainingHours(enrollments: { timeSpentMinutes: number }[]): number` (hours, 2dp).
- Produces: `kirkpatrickGain(preScore: number, postScore: number): number` (delta %, 2dp; 0 when pre<=0).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computeTrainingHours, kirkpatrickGain } from '@/lib/engines/training-hours-engine';

describe('training-hours-engine', () => {
  it('menjumlahkan menit menjadi jam', () => {
    expect(computeTrainingHours([{ timeSpentMinutes: 60 }, { timeSpentMinutes: 90 }])).toBe(2.5);
    expect(computeTrainingHours([])).toBe(0);
  });
  it('menghitung Kirkpatrick gain (post-pre)/pre dalam persen', () => {
    expect(kirkpatrickGain(60, 80)).toBeCloseTo(33.33, 1);
    expect(kirkpatrickGain(0, 80)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** --- FAIL.

- [ ] **Step 3: Implement**

```ts
export function computeTrainingHours(enrollments: { timeSpentMinutes: number }[]): number {
  if (!enrollments || enrollments.length === 0) return 0;
  const minutes = enrollments.reduce((s, e) => s + (e.timeSpentMinutes || 0), 0);
  return Number((minutes / 60).toFixed(2));
}

export function kirkpatrickGain(preScore: number, postScore: number): number {
  if (preScore <= 0) return 0;
  return Number((((postScore - preScore) / preScore) * 100).toFixed(2));
}
```

- [ ] **Step 4: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): training hours + Kirkpatrick gain engine"
```

---

### Task 7: competency-gpa-engine (DUR-03)

**Files:**
- Create: `src/lib/engines/competency-gpa-engine.ts`
- Test: `tests/unit/competencyGpaEngine.test.ts` (new)

**Interfaces:**
- Produces: `deriveCompetencyScore(input: CompetencyGpaInput): number` (0--100).
  - `type CompetencyGpaInput = { competencyLevels: number[]; gapSum: number; trainingHours: number;
    cfg?: { targetHours?: number; gapPenaltyPerPoint?: number } }`
  - Default `targetHours` 24 (PRD --3.2), `gapPenaltyPerPoint` 5.
  - Formula: `70 + (avgLevel/5)*20 --- gapSum*gapPenalty + min(trainingHours/targetHours,1)*10`, clamp 0..100.
  - Empty `competencyLevels` --- base only (70), finite.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { deriveCompetencyScore } from '@/lib/engines/competency-gpa-engine';

describe('competency-gpa-engine', () => {
  it('skor tinggi untuk level tinggi, gap nol, jam terpenuhi', () => {
    expect(deriveCompetencyScore({ competencyLevels: [5, 5, 5, 5], gapSum: 0, trainingHours: 24 })).toBe(100);
  });
  it('penalti gap menurunkan skor', () => {
    const hi = deriveCompetencyScore({ competencyLevels: [4, 4], gapSum: 0, trainingHours: 24 });
    const lo = deriveCompetencyScore({ competencyLevels: [4, 4], gapSum: 3, trainingHours: 24 });
    expect(lo).toBeLessThan(hi);
  });
  it('null-safe: level kosong tetap finite (=70)', () => {
    expect(deriveCompetencyScore({ competencyLevels: [], gapSum: 0, trainingHours: 0 })).toBe(70);
  });
});
```

- [ ] **Step 2: Run to verify failure** --- FAIL.

- [ ] **Step 3: Implement**

```ts
export interface CompetencyGpaInput {
  competencyLevels: number[];
  gapSum: number;
  trainingHours: number;
  cfg?: { targetHours?: number; gapPenaltyPerPoint?: number };
}

export function deriveCompetencyScore(input: CompetencyGpaInput): number {
  const targetHours = input.cfg?.targetHours ?? 24;
  const gapPenalty = input.cfg?.gapPenaltyPerPoint ?? 5;
  const levels = input.competencyLevels ?? [];
  const avgLevel = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;
  const levelComponent = (avgLevel / 5) * 20;
  const hoursComponent = targetHours > 0 ? Math.min(input.trainingHours / targetHours, 1) * 10 : 0;
  const raw = 70 + levelComponent - input.gapSum * gapPenalty + hoursComponent;
  return Number(Math.min(100, Math.max(0, raw)).toFixed(2));
}
```

- [ ] **Step 4: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): competency to GPA score engine (DUR-03)"
```


---

## WS-3 -- Services & Observer

### Task 8: learningLmsService (catalog, enroll, progress, complete)

**Files:**
- Create: `src/lib/services/learningLmsService.ts`
- Test: `tests/integration/learningLmsService.test.ts` (new)

**Interfaces:**
- Consumes: `getDb()`; migration 0009 tables.
- Produces:
  - `listCourses(phase?: 'PRE'|'DURING'|'POST')` --- `Array<{ id, courseCode, title, category, targetPhase, isMandatory, defaultHours }>`.
  - `enrollLocal(employeeId: string, courseId: number)` --- enrollment row (idempotent upsert; sets `completion_state='IN_PROGRESS'`).
  - `recordProgress(employeeId: string, courseId: number, pct: number, minutes?: number)` --- updates `completion_pct`, `time_spent_minutes`, `last_activity_at`; sets `completion_state` via `resolveCompletionState`.
  - `completeCourse(employeeId: string, courseId: number)` --- sets `completion_pct=100`, `completion_state='COMPLETE'`, `completed_at=now()`, then calls `onCourseCompleted`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/learningLmsService.test.ts` (uses `createTestDb()` + `runSeed`):
- `listCourses('PRE')` returns --- 2 with `targetPhase==='PRE'`.
- `enrollLocal(BUDI, <duringCourseId>)` then `recordProgress(BUDI, id, 50)` --- row has `completion_pct 50`, `completion_state 'IN_PROGRESS'`.
- `completeCourse(BUDI, id)` --- `completion_state 'COMPLETE'`, `completed_at` non-null.

- [ ] **Step 2: Run to verify failure** --- `.\node_modules\.bin\vitest.cmd run tests/integration/learningLmsService.test.ts` --- FAIL.

- [ ] **Step 3: Implement**

Implement with `getDb()` raw queries (repo pattern). `enrollLocal` uses
`INSERT ... ON CONFLICT (employee_id, moodle_course_id) DO UPDATE` and resolves the `moodle_courses.id`
FK. `recordProgress`/`completeCourse` use `UPDATE ... WHERE employee_id=$1 AND moodle_course_id=$2`.
`completeCourse` invokes `onCourseCompleted(db, employeeId, courseId)` from Task 9.

- [ ] **Step 4: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): learning service (catalog, enroll, progress, complete)"
```

---

### Task 9: lmsObserver (course completion --- evidence --- badge) -- idempotent

**Files:**
- Create: `src/lib/services/lmsObserver.ts`
- Test: `tests/integration/lmsObserver.test.ts` (new)

**Interfaces:**
- Consumes: `course_competencies`, `competency_evidence`, `badge_criteria`, `badge_awards`, engines 4/5.
- Produces: `onCourseCompleted(db: SqlClient, employeeId: string, courseId: number): Promise<{ evidenceCreated: number; badgesAwarded: string[] }>`.
  - For each `course_competencies` row of the course with `outcome <> 'NONE'`: insert `competency_evidence`
    (source COURSE, action derived: COMPLETE---COMPLETE, EVIDENCE/RECOMMEND---LOG), `ON CONFLICT DO NOTHING`
    (requires a UNIQUE on (employee_id, competency_id, course_id) -- add it in migration 0009).
  - Build `BadgeContext` from completed courses + derived competency levels; for each active badge whose
    `badge_criteria` pass `evaluateBadgeCriteria`, insert `badge_awards ON CONFLICT (badge_id, employee_id) DO NOTHING`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lmsObserver.test.ts`:
- After seed, `completeCourse(BUDI, cloudArchCourseId)` --- `competency_evidence` row exists for the linked competency; returns `evidenceCreated --- 1`.
- Completing the same course again --- evidence count unchanged (idempotent) and no duplicate `badge_awards`.

- [ ] **Step 2: Run to verify failure** --- FAIL.

- [ ] **Step 3: Implement**

Implement `onCourseCompleted` using `getDb()` + the engines. Guard every insert with `ON CONFLICT DO NOTHING`.
Derive `competencyLevels` by averaging `competency_evidence.rating` per competency (SQL GROUP BY).

- [ ] **Step 4: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): idempotent course-completion observer (evidence + badge)"
```

---

### Task 10: competencyService + learningPlanService

**Files:**
- Create: `src/lib/services/competencyService.ts`, `src/lib/services/learningPlanService.ts`
- Test: `tests/integration/competencyAndPlanService.test.ts` (new)

**Interfaces:**
- Produces:
  - `competencyService.getCompetencyProfile(db, employeeId)` --- `{ competencies: Array<{ id, name, framework, level, requiredLevel, gap, deficient }> }`.
  - `competencyService.upsertCompetencyEvidence(db, { employeeId, competencyId, source, courseId?, rating, action?, notes? })`.
  - `learningPlanService.createPlan(db, { employeeId, title, periodId })`; `addPlanItem(db, { planId, competencyId?, courseId?, targetLevel? })`; `advancePlanItem(db, itemId, status)`.

- [ ] **Step 1: Write the failing test**

`tests/integration/competencyAndPlanService.test.ts`:
- `getCompetencyProfile(db, BUDI)` returns competencies with finite `level`/`gap`.
- `createPlan` then `addPlanItem` then `advancePlanItem(id,'DONE')` --- status persisted.
- `getCompetencyProfile` for an employee with no evidence --- empty array (no throw).

- [ ] **Step 2: Run to verify failure** --- FAIL.

- [ ] **Step 3: Implement** (getDb raw queries; null-safe aggregates)

- [ ] **Step 4: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): competency profile + learning plan services"
```

---

## WS-4 -- API Routes & RBAC

### Task 11: RBAC permissions + learning routes

**Files:**
- Modify: `src/lib/auth/rbac.ts` (add `learning:read`, `learning:write`, `learning:manage` to the union + MATRIX)
- Create: `src/app/api/v1/learning/courses/route.ts`, `recommendations/route.ts`, `enrollments/route.ts`, `enrollments/[id]/route.ts`, `my-learning/route.ts`, `competency-profile/[employeeId]/route.ts`, `learning-plans/route.ts`, `learning-plans/[id]/items/route.ts`, `badges/route.ts`, `training-summary/route.ts`
- Modify: `src/app/api/v1/learning/moodle/route.ts` (delegate to `enrollLocal`)
- Test: `tests/api/learning-routes.test.ts` (new)

**Interfaces:**
- Consumes: services (Tasks 8--10), `getAuthSession`, `assertCan`, `scope.ts`.
- Produces: the 10 endpoints in spec --3 WS-3.

- [ ] **Step 1: Write the failing route tests**

`tests/api/learning-routes.test.ts`:
- `GET /learning/courses` 401 without cookie; 200 with EMPLOYEE cookie, `data.courses` array.
- `GET /learning/competency-profile/<otherId>` as EMPLOYEE --- 403 (scope).
- `POST /learning/enrollments` with valid courseId --- 200; missing body --- 400.
- `GET /learning/my-learning` --- `data` has `courses`, `trainingHours`, `badges`.

- [ ] **Step 2: Run to verify failure** --- FAIL (routes 404 / RBAC missing).

- [ ] **Step 3: Add permissions**

In `rbac.ts`: add the three permissions to the `Permission` union; matrix:
`'learning:read'`: all roles; `'learning:write'`: EMPLOYEE, PEOPLE_MANAGER, HR_MANAGER, SUPER_ADMIN;
`'learning:manage'`: HR_MANAGER, SUPER_ADMIN.

- [ ] **Step 4: Implement the routes**

Each: `getAuthSession` --- `assertCan` --- scope (for employee-specific) --- service call --- `ok()`; `problem()` on error;
`zod` body validation. `enrollments/[id]` PATCH accepts `{ progressPct?, minutes?, complete? }`.

- [ ] **Step 5: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): learning API routes + RBAC permissions"
```

---

### Task 12: Wire DUR-03 into appraisal GPA from LMS data

**Files:**
- Modify: `src/lib/services/appraisalService.ts` (or the GPA route) to optionally derive `competencyScore`
- Create: `src/lib/services/competencyScoreService.ts` (DB-backed orchestrator using engine Task 7)
- Test: `tests/integration/competency-score-gpa.test.ts` (new)

**Interfaces:**
- Consumes: `competencyService.getCompetencyProfile`, `training-hours-engine`, `competency-gpa-engine`.
- Produces: `deriveCompetencyScoreForEmployee(db, employeeId, periodId): Promise<number>` (0--100),
  computed from competency levels + gap sum + training hours. `calculateCompositeGPA` signature is UNCHANGED;
  the caller passes this value as `competencyScore`.

- [ ] **Step 1: Write the failing test**

`tests/integration/competency-score-gpa.test.ts`:
- `deriveCompetencyScoreForEmployee(db, BUDI, periodId)` returns a finite 0--100 number.
- With the same inputs and no LMS data --- falls back to the static competency score passed by the caller
  (assert `calculateCompositeGPA` with the original `competencyScore` yields the known PRD --11.3 result 3.67).
- Passing the derived score produces a valid GPA within 0--4.

- [ ] **Step 2: Run to verify failure** --- FAIL.

- [ ] **Step 3: Implement**

Add `competencyScoreService.deriveCompetencyScoreForEmployee` (aggregates profile + hours into engine Task 7).
Update the GPA caller to use it when LMS data exists; otherwise keep the provided `competencyScore`. Document
the switch in ADR 009 (Task 14). Do NOT modify `gpa-engine.ts`.

- [ ] **Step 4: PASS + commit**

```bash
git add -A; git commit -m "feat(lms): derive DUR-03 competency score from LMS data (backward-compatible)"
```

---


## WS-5 -- UI (frontend-design skill)

### Task 13: Employee "Learning & Development" module + HR panel

**Files:**
- Modify: `src/app/dashboard/employee-portal/page.tsx` (add Learning section/section card)
- Create: `src/components/employee/LearningModule.tsx`, `src/components/employee/CourseCatalogModal.tsx`, `src/components/employee/CompetencyProfileCard.tsx`, `src/components/employee/LearningPlanModal.tsx`, `src/components/employee/BadgeShelf.tsx`
- Modify: `src/components/employee/CareerPathModal.tsx` (replace `alert('...via LTI SSO')` with a real `POST /learning/enrollments`)
- Modify: `src/app/dashboard/hr-command/page.tsx` (Learning & Certification panel: completion per phase, badges issued, training hours, manage catalog)
- Test: build + browser smoke (no new unit test required beyond Task 11's route tests)

**Interfaces:**
- Consumes: `/api/v1/learning/*` endpoints (Task 11).

- [ ] **Step 1: Build the employee Learning module**

Fetch `/learning/my-learning`, `/learning/courses`, `/learning/recommendations`, `/learning/competency-profile/<self>`, `/learning/badges`.
Render: progress bars per course, training-hours YTD vs 24h target, competency levels (1--5), badge shelf
(earned/locked), and a "Daftar" action calling `POST /learning/enrollments` (then refresh). Use `frontend-design`
guidance for layout/visuals (dense scanability, accessible contrast, keyboard-operable modals).

- [ ] **Step 2: Fix CareerPathModal**

Replace the `alert(...)` stub with a real enroll call; show a success state from the API response.

- [ ] **Step 3: HR panel**

In `hr-command`, add a panel driven by `/learning/training-summary` (completion by phase, training hours,
badges issued, DUR-03 contribution) and a simple catalog/badge management form (`learning:manage`).

- [ ] **Step 4: Build + smoke**

Run: `npm run build` --- success. Smoke: as EMPLOYEE, open portal --- Learning section renders DB data; enroll a
course --- progress appears; as HR, panel shows aggregates.

- [ ] **Step 5: Commit**

```bash
git add -A; git commit -m "feat(lms-ui): employee Learning module + HR Learning panel"
```

---

## WS-6 -- Verification, ADRs, README

### Task 14: Full verification, ADRs 008/009, README

**Files:**
- Create: `docs/decisions/008-moodle-native-adaptation.md`, `docs/decisions/009-competency-training-to-gpa.md`
- Modify: `README.md` (Learning module + run notes)

- [ ] **Step 1: Full verification**

Run: `.\node_modules\.bin\vitest.cmd run` --- all pass (existing + new) and `npm run build` --- success, and `npm run db:reset` --- success.

- [ ] **Step 2: Write ADR 008**

Why Moodle's model is adopted natively (no external LMS server); what was adopted (completion tracking,
competency framework + evidence, badges + criteria, learning plans); the `LmsConnector` seam left for a future
REST/LTI adapter; non-goals.

- [ ] **Step 3: Write ADR 009**

How training/competency feeds the GPA Competency component (DUR-03): the caller supplies a derived
`competencyScore` (engine Task 7); `calculateCompositeGPA` is unchanged; default behavior without LMS data is
identical to before (backward-compatible); configurable targets (`targetHours` 24, `gapPenaltyPerPoint` 5).

- [ ] **Step 4: Update README**

Document the Learning module, the lifecycle mapping (Pre/During/Post), and how to run `db:reset` for the new tables.

- [ ] **Step 5: Commit**

```bash
git add -A; git commit -m "docs(lms): ADRs 008/009 and README updates"
```

---

## Spec Coverage Check

| Spec WS | Plan task(s) |
|---|---|
| WS-1 Schema (0009) | Task 1 |
| WS-1 Seed | Task 2 |
| WS-2 completion-engine | Task 3 |
| WS-2 competency-evidence-engine | Task 4 |
| WS-2 badge-award-engine | Task 5 |
| WS-2 training-hours-engine | Task 6 |
| WS-2 competency-gpa-engine | Task 7 |
| WS-2 learningLmsService | Task 8 |
| WS-2 lmsObserver | Task 9 |
| WS-2 competencyService + learningPlanService | Task 10 |
| WS-3 API + RBAC | Task 11 |
| WS-3 DUR-03 integration | Task 12 |
| WS-4 UI | Task 13 |
| WS-5 Verification + ADR | Task 14 |

## Execution Handoff

Two execution options:

- **Subagent-driven** -- a fresh implementer per task + independent review. Recommended when a writable
  subagent/model is available; tasks 11--13 are interface-coupled (routes consume services; UI consumes routes).
- **Native (inline)** -- the controller implements each task in this session (TDD per task, commit per task),
  with one whole-branch review at the end. This is the path used for the prior remediation because the paid
  model gateway was unavailable.

Task ordering is strict: Task 1 --- 2 --- 3---7 (engines) --- 8 --- 9 --- 10 (services) --- 11 (routes) --- 12 (GPA) ---
13 (UI) --- 14 (docs). Each task is independently testable; do not start a task whose Interfaces' `Consumes`
are not yet committed.

