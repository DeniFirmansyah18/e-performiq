# ADR 005 — Reference Data and Industry Benchmarks as Seeded Tables

**Status:** Accepted (2026-09-30)
**Context:** WS-1 (Tasks 6–7) of the demo→production remediation.

## Decision
Values that must be changeable **without deploying code** — industry benchmark
figures and corporate vision/mission — are stored in database tables
(`industry_benchmarks`, `company_vision_mission`), seeded idempotently, not as
literals inside route handlers or engines.

Values that should be **derived** from operational data — pillar achievement
scores, headcount, Quality of Hire averages, KPI totals — are computed by
SQL aggregation, never stored as constants.

## Rationale
- Benchmark thresholds (e.g. VMAI target 85, turnover max 3%) change with
  market/regulatory cycles; a non-developer should be able to update them.
- Hardcoded `92.4` VMAI and `1240` headcount previously misled executive
  decisions because they never changed when data changed.

## Consequences
- Migration `0007_reference_data.sql` adds the two tables; the seed fills 19
  benchmark rows + 1 vision/mission row.
- `analyticsSummaryService.getBenchmarkGap/getExecutiveSummary/getLifecycleSummary`
  read benchmarks from the table and aggregate operational metrics live.
- `selectActivePillars` computes `achievedScore` from `individual_kpis`.

## Cost if wrong
Benchmark values live in seed SQL rather than an admin UI; changing them today
requires a seed edit or a SQL update. A future admin CRUD screen is the natural
follow-up.
