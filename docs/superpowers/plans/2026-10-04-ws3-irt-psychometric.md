# WS-3: Psychometric IRT Engine (30%) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CTT Likert scoring for the PSYCHOMETRIC component with an Item Response Theory (IRT) model that estimates each candidate's latent ability θ and converts it to a 0–100 score (still 30% of the composite).

**Architecture:** A pure engine `src/lib/engines/irt-engine.ts` implements the 2PL/3PL item response function, test information, and θ estimation (EAP over a quadrature grid, MLE fallback). `assessmentService.submitAttempt` for `type='PSYCHOMETRIC'` calls the engine with the item parameters (`irt_a`, `irt_b`, `irt_c`) and the 0/1 responses (Likert ≥ neutral → 1). The θ is mapped to 0–100 via the standard normal CDF (percentile). Composite weights stay 30/40/30. Questions lacking parameters fall back to the existing CTT path.

**Tech Stack:** TypeScript (no deps), Vitest 2, Drizzle `sql`.

**Spec:** `docs/superpowers/specs/2026-10-04-production-gap-closure-design.md` (§ WS-3). Reference: IRT (Item Response Theory) — 1PL/2PL/3PL, EAP estimation, test information.

## Global Constraints

- Engine is pure/deterministic; no I/O; safe on empty input (returns `{ theta: 0, score0to100: 50 }` sentinel).
- New migration `0020_irt_parameters.sql` adds `assessment_questions.irt_c NUMERIC(6,3)`; `irt_a`/`irt_b` already exist.
- Update `tests/integration/schema.test.ts` only if a table/enum changes (a column add does NOT change table count — verify).
- Composite weights unchanged: 30/40/30.
- Commit per task; run `npm run db:reset` before full suite.

## Review Focus

- **All-correct / all-wrong response patterns** → θ bounded (finite), score clamps to 0..100 (no NaN/Infinity from log(0)).
- **Items with missing parameters** → fall back to CTT for that attempt, not a crash.
- **Single-answer tests** → still produce a finite θ (EAP is well-defined; MLE would diverge → EAP default).
- **Reverse-scored items** → polarity applied before binarization.
- **Determinism** → same input → same θ/score every run.

---

### Task 1: Pure IRT engine

**Files:**
- Create: `src/lib/engines/irt-engine.ts`
- Test: `tests/integration/irtEngine.test.ts` (unit-style, no DB)

**Interfaces:**
- Produces:
  - `type IrtItem = { a: number; b: number; c?: number }`
  - `probability(theta: number, item: IrtItem): number` — 3PL: `c + (1-c) / (1 + exp(-a*(theta-b)))`
  - `itemInformation(theta: number, item: IrtItem): number`
  - `testInformation(theta: number, items: IrtItem[]): number`
  - `estimateTheta(responses: Array<0|1>, items: IrtItem[]): { theta: number; se: number; method: 'EAP'|'MLE' }`
  - `thetaToScore(theta: number): number` — 0..100 via normal CDF
  - `scoreIrt(responses: Array<0|1>, items: IrtItem[]): { theta: number; score0to100: number; information: number }`

- [ ] **Step 1: Write failing tests**

Create `tests/integration/irtEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { probability, itemInformation, testInformation, estimateTheta, thetaToScore, scoreIrt } from '@/lib/engines/irt-engine';

describe('IRT engine', () => {
  it('2PL probability monotone naik terhadap theta', () => {
    const it = { a: 1.2, b: 0.0 };
    expect(probability(-3, it)).toBeLessThan(probability(0, it));
    expect(probability(0, it)).toBeCloseTo(0.5, 5);
    expect(probability(3, it)).toBeGreaterThan(probability(0, it));
  });

  it('3PL mendekati c saat theta sangat rendah', () => {
    const it = { a: 1.0, b: 0.0, c: 0.2 };
    expect(probability(-6, it)).toBeCloseTo(0.2, 2);
  });

  it('informasi item positif & informasi tes = jumlah', () => {
    const items = [{ a: 1, b: -1 }, { a: 1, b: 0 }, { a: 1, b: 1 }];
    expect(itemInformation(0, items[0])).toBeGreaterThan(0);
    const sum = items.reduce((s, it) => s + itemInformation(0, it), 0);
    expect(testInformation(0, items)).toBeCloseTo(sum, 8);
  });

  it('EAP: pola semua benar → theta tinggi; semua salah → rendah', () => {
    const items = [{ a: 1, b: -1 }, { a: 1, b: 0 }, { a: 1, b: 1 }];
    const hi = estimateTheta([1, 1, 1], items);
    const lo = estimateTheta([0, 0, 0], items);
    expect(hi.theta).toBeGreaterThan(0.5);
    expect(lo.theta).toBeLessThan(-0.5);
    expect(Number.isFinite(hi.theta)).toBe(true);
    expect(Number.isFinite(lo.theta)).toBe(true);
    expect(hi.method).toBe('EAP');
  });

  it('thetaToScore memetakan 0 → ~50, monoton', () => {
    expect(thetaToScore(0)).toBeCloseTo(50, 0);
    expect(thetaToScore(2)).toBeGreaterThan(thetaToScore(0));
    expect(thetaToScore(-2)).toBeLessThan(thetaToScore(0));
  });

  it('scoreIrt: deterministik & 0..100', () => {
    const items = [{ a: 1, b: 0 }, { a: 1, b: 0.5 }, { a: 1, b: -0.5 }];
    const a = scoreIrt([1, 0, 1], items);
    const b = scoreIrt([1, 0, 1], items);
    expect(a).toEqual(b);
    expect(a.score0to100).toBeGreaterThanOrEqual(0);
    expect(a.score0to100).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/irtEngine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/engines/irt-engine.ts`:
- `probability(theta, item)`: clamp `c` to [0,0.35]; `c + (1-c)/(1+exp(-a*(theta-b)))`.
- `itemInformation(theta, item)`: for 2PL `a²·P·(1-P)`; for 3PL `a²·((P-c)/(1-c))²·((1-P)/P)` (guard P>0).
- `testInformation`: sum over items.
- `estimateTheta`: EAP — quadrature grid θ∈[-4,4] step 0.1, prior N(0,1); likelihood = Π P_i^{x_i}(1-P_i)^{1-x_i}; posterior ∝ prior·likelihood; θ̂ = Σθ·post / Σpost; SE = sqrt(Σ(θ-θ̂)²·post/Σpost). If a computation yields 0 likelihood everywhere, fall back to `MLE` (Newton or grid argmax) then clamp. Return `{theta, se, method}`.
- `thetaToScore(theta)`: normal CDF → percentile×100, clamp 0..100. Implement CDF via `0.5*(1+erf(theta/√2))` with a local `erf` approximation (Abramowitz-Stegun 7.1.26).
- `scoreIrt(responses, items)`: align lengths; `{theta, score0to100: thetaToScore(theta), information: testInformation(theta, items)}`.

- [ ] **Step 4: Run to verify pass**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/irtEngine.test.ts -v`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/irt-engine.ts tests/integration/irtEngine.test.ts
git commit -m "feat(engine): pure IRT engine (2PL/3PL, EAP theta, test information)"
```

---

### Task 2: Migration — `irt_c` column

**Files:**
- Create: `src/lib/db/migrations/0020_irt_parameters.sql`

**Interfaces:**
- Produces: `assessment_questions.irt_c NUMERIC(6,3)`.

- [ ] **Step 1: Write migration**

```sql
-- 0020_irt_parameters.sql
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS irt_c NUMERIC(6,3);
```

- [ ] **Step 2: Run + commit**

Run: `npm run db:reset` (Expected: seed selesai).

```bash
git add src/lib/db/migrations/0020_irt_parameters.sql
git commit -m "feat(db): add irt_c parameter column to assessment_questions (migration 0020)"
```

---

### Task 3: Wire IRT into `assessmentService` (PSYCHOMETRIC)

**Files:**
- Modify: `src/lib/services/assessmentService.ts` (`submitAttempt` psychometric branch)
- Modify: `src/lib/db/seed/index.ts` (assign `irt_a`,`irt_b` to IPIP questions)
- Test: `tests/integration/assessmentService.test.ts` (add IRT assertions)

**Interfaces:**
- Consumes: `scoreIrt`, `thetaToScore` (Task 1).
- Produces: psychometric attempts scored by θ→0..100; composite unchanged 30/40/30.

- [ ] **Step 1: Add a failing test** asserting a psychometric attempt with a strong-response pattern scores higher than a weak pattern, and the composite still uses 30%.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** — in the PSYCHOMETRIC branch, read each question's `irt_a/irt_b/irt_c`; if present for ≥1 item, binarize responses (Likert ≥ neutral → 1, applying `reverse_scored`), call `scoreIrt`, use `score0to100`; else use the existing CTT path. Seed: give IPIP items heuristic parameters (e.g. `a` 0.8–1.5, `b` -1..1, `c` 0).
- [ ] **Step 4: Run to verify pass** — `.\node_modules\.bin\vitest.cmd run tests/integration/assessmentService.test.ts -v`.
- [ ] **Step 5: Commit**

```bash
git add src/lib/services/assessmentService.ts src/lib/db/seed/index.ts tests/integration/assessmentService.test.ts
git commit -m "feat(assessment): IRT scoring for psychometric component (EAP theta), CTT fallback"
```

---

## Self-Review

**Spec coverage (§ WS-3):** engine (Task 1), `irt_c` migration (Task 2), service wiring + seed params (Task 3), weights unchanged (Task 3). ✓
**Placeholder scan:** Task 3 steps describe edits against named functions; code shown for the risky pure engine (Task 1). Acceptable.
**Type consistency:** `scoreIrt`/`thetaToScore` names match between Task 1 and Task 3. ✓
**Review Focus → tests:** all-correct/all-wrong (Task 1 test 4), missing params fallback (Task 3), single-answer (EAP default, Task 1 test 4), reverse-scored (Task 3 binarization), determinism (Task 1 test 6). ✓
