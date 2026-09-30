# ADR 009 - Competency/Training Contribution to GPA (DUR-03)

**Status:** Accepted (2026-09-30)
**Context:** Moodle LMS integration (plan `2026-09-30-moodle-lms-integration`), Task 12.

## Decision
Training and competency data collected via the LMS model may feed the **Competency**
component (DUR-03, weight 15%) of an employee's Composite GPA. This is done by having
the **caller** compute a `competencyScore` (0-100) from LMS data and pass it into the
existing `calculateCompositeGPA(req)` — the GPA engine itself is **unchanged**.

`deriveCompetencyScore(input)` formula (engine `competency-gpa-engine`):
`70 + (avgLevel/5)*20 - gapSum*gapPenaltyPerPoint + min(trainingHours/targetHours,1)*10`, clamped 0-100.
Defaults: `targetHours` = 24 (PRD §3.2), `gapPenaltyPerPoint` = 5. `targetHours` may be
overridden from `industry_benchmarks` (`TRAINING_HOURS_MIN`) when present.

## Rationale
- `GPARequest` already has a `competencyScore` field, so no signature change is needed —
  the integration point is the caller, not the engine.
- Backward compatibility: with no LMS data the engine returns a base score (70); callers
  that pass their own `competencyScore` keep the exact previous behavior.
- The PRD §3.2 explicitly lists "Training Hours & Effectiveness (Kirkpatrick L2/L3)" and
  DUR-03 "Competency Mastery" as GPA-relevant, so this is spec-aligned.

## Consequences
- New `competencyScoreService.deriveCompetencyScoreForEmployee(db, employeeId, periodId)`.
- Regression guard: `calculateCompositeGPA` with the original inputs still yields the
  PRD §11.3 result (compositeGPA 3.67) — pinned by `competency-score-gpa.test.ts`.
- Weights/thresholds are configurable; no test-locked magic numbers in the engine.

## Cost if wrong
If the training→GPA linkage is deemed undesirable later, callers can simply stop passing
the derived score; the engine and all prior behavior remain intact.
