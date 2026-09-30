# Task 1 Brief — Repair the `performance_appraisals` seed row

## Context
E-PerformIQ demo → production. The seed currently throws and blocks 10 test suites.
Root cause VERIFIED: the `INSERT INTO performance_appraisals` statement has 16 columns
but 17 values (a stray 4th UUID before `92.50`), causing Postgres error 42601 at offset 14107.

## Files
- Modify: `src/lib/db/seed/index.ts` — the `INSERT INTO performance_appraisals` statement
- Test: `tests/integration/seed.test.ts` (existing, currently FAILING)

## Global constraints (bind this task)
- Migrations/seed SQL must be idempotent (`ON CONFLICT DO NOTHING`).
- Tests use `createTestDb()` from `tests/setup.ts`; never touch `.pglite/`.
- Run tests with `npx vitest run`.

## Steps
1. Run `npx vitest run tests/integration/seed.test.ts -v` → confirm it FAILS with
   `error: INSERT has more expressions than target columns` (16 cols, 17 vals).
2. Fix the row. The header columns are:
   `id, period_id, employee_id, kpi_composite_score, sop_compliance_score, competency_score,
    core_values_score, total_percentage_score, composite_gpa, performance_rating, potential_score,
    nine_box_quadrant, is_calibrated, calibrated_by, calibrated_at, calibration_notes`
   (16 columns). The correct row is (employee_id MUST be Budi = b0000000-0000-4000-8000-000000000004,
   and the stray CEO UUID BEFORE `92.50` must be removed):
   ```sql
   -- Budi's Performance Appraisal (PRD §11.3 values)
   INSERT INTO performance_appraisals (id, period_id, employee_id, kpi_composite_score, sop_compliance_score, competency_score, core_values_score, total_percentage_score, composite_gpa, performance_rating, potential_score, nine_box_quadrant, is_calibrated, calibrated_by, calibrated_at, calibration_notes) VALUES
     ('40000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004',92.50,96.00,85.00,90.00,91.70,3.67,'A',4.20,'FUTURE_LEADER',TRUE,'e0000000-0000-4000-8000-000000000002','2026-09-18T10:00:00Z','Dikalibrasi oleh Komite Kinerja Human Capital')
   ON CONFLICT (id) DO NOTHING;
   ```
3. Run `npx vitest run tests/integration/seed.test.ts -v` → confirm PASS (all `seed data` cases green).
4. Commit:
   ```bash
   git add src/lib/db/seed/index.ts
   git commit -m "fix(seed): remove stray UUID in performance_appraisals row (16 cols/17 vals)"
   ```

## Report contract
Write your full report to the report file path given in the dispatch. Return only:
status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), commit sha(s),
one-line test summary, and any concerns.
