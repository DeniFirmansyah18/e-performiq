# ADR 008 - Native Adaptation of the Moodle LMS Model

**Status:** Accepted (2026-09-30)
**Context:** Moodle LMS integration (plan `2026-09-30-moodle-lms-integration`).

## Decision
Adopt Moodle's LMS **model and rules** natively into E-PerformIQ's own database and
engines, rather than integrating with a live Moodle server. Adopted concepts:
- **Course/activity completion tracking** (progress %, completion state) — mirroring
  Moodle `completion/progress.php`.
- **Competency framework + competencies + evidence** with ratings — mirroring
  `core_competency` (course/activity → evidence on completion).
- **Badges with criteria** (COURSE / COMPETENCY / COURSESET, rule ALL) — mirroring
  `core_badges`.
- **Learning plans (IDP)** — mirroring `admin/tool/lp`.

Mapping to the employee lifecycle:
- **Pre-Employment:** mandatory onboarding courses + onboarding badge.
- **During-Employment:** competency evidence + training hours → GPA DUR-03 (ADR 009).
- **Post-Employment:** certification/legacy records.

## Rationale
- No Moodle server or credentials exist; a remote connector could not be verified
  (violating the "verify before completion" discipline).
- PGlite already runs full PostgreSQL 16, so the model ports cleanly.
- The rules (completion aggregation, evidence derivation, badge criteria) are pure
  logic — ideal for unit testing.

## Consequences
- Migration `0009_moodle_lms.sql` adds 10 tables + 9 enums + 3 enrollment columns.
- Pure engines: `completion-engine`, `competency-evidence-engine`, `badge-award-engine`,
  `training-hours-engine`, `competency-gpa-engine`.
- Services: `learningLmsService`, `competencyService`, `learningPlanService`, and the
  idempotent `lmsObserver` (course completion → evidence → badge).
- API under `/api/v1/learning/*`; UI module in the employee portal + HR panel.

## Deferred / seam
A future `LmsConnector` (REST Web Services / LTI 1.3) can push/pull real Moodle data
behind the same service interface. Non-goals: forking Moodle/PHP, remote LMS, async queue.

## Cost if wrong
We maintain our own LMS-model tables instead of syncing a real LMS; the native model is
the source of truth until a connector is added.
