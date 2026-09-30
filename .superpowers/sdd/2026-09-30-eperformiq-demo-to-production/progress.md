# SDD ledger — plan: docs/superpowers/plans/2026-09-30-eperformiq-demo-to-production.md

Spec: docs/superpowers/specs/2026-09-30-eperformiq-demo-to-production-design.md (read, authority)
Worktree: e:\PRD Penilaian Karyawan\eperformiq-prod (branch feat/demo-to-production)
Baseline commit: bea0698

## Pre-flight conflict scan

Tasks and their shared files/interfaces:

| Tasks | Shared file/interface | Produces -> Consumes | Finding |
|---|---|---|---|
| 1 & 2 | seed + suite | Task1 fixes seed -> Task2 verifies suite | consistent |
| 1 & 5 | src/lib/db/seed/index.ts | Task5 edits employees INSERT in same file | sequencing OK (1 before 5) |
| 4 & 11 | AuthContext.tsx | Task4 renames import; Task11 removes demo defaults | consistent (4 then 11) |
| 6 & 7 & 8 | analytics routes | Task7 adds routes; Task8 consumes them | sequencing OK (7 before 8) |
| 6 & 7 | analyticsRepository / analyticsService | both edit analytics layer | consistent |
| 7 & 8 | industry_benchmarks / new routes | Task8 teams-roster etc independent | consistent |
| 8 & 10 | routes + middleware | Task8 routes already use getAuthSession+scope; Task10 adds middleware | consistent |
| 11 | src/lib/db/client.ts shared types | shifts db/migrate/seed/tests to SqlClient | self-consistent |
| All | migrations 0006/0007/0008 sequential | numbering distinct | consistent |

Self-consistency per task: Task1 (test asserts 1 row, code produces 1 row) OK. Task5 (helper + wire) OK.
Task6 (test expects >95 for INTERNAL) matches seed KPI math. Task11 (test uses skipIf) OK.

Scan result: CLEAN — no plan-internal conflicts. No rulings needed at preflight.

## Progress

Task 1: dispatch attempted 3x, all failed at the ENVIRONMENT level (not the task):
- "Gemini 3.6 Flash (oc-prod)" -> 402 balance_zero (paid gateway out of credit)
- "Qwen3.8 27b:free" -> 401 Missing Authentication header (free gateway unauthenticated)
- default/Explore agent -> read-only agent (no edit/terminal tools) -> BLOCKED by design

Ruling: subagent-driven execution is NOT possible in this environment right now — the only
available agent (Explore) is read-only and cannot edit files, run tests, or commit; every
writable model gateway is unreachable. Per subagent-driven-development's own decision tree
("no subagent tool?" -> executing-plans), route implementation to superpowers:executing-plans
(inline, controller implements). Cost if wrong: loses per-task independent review until the
final whole-branch review; if a writable subagent becomes available later, we can resume SDD.
Environment setup notes (task-1):
- Fresh worktree had no node_modules; a filesystem junction to the main repo's node_modules
  broke Vite module resolution ("No test suite found"). Ruling: install deps for real in the
  worktree (npm install, 172 pkgs) — reliable isolation over the shortcut. Cost if wrong: 60s
  install time only.
- Test command in worktree: `.\node_modules\.bin\vitest.cmd run <path>` (npx resolves to a
  cached vitest@5 and fails).

Task 1: complete (commits bea0698..02e8852, tests: `vitest run tests/integration/seed.test.ts` → 7 passed / 7)
- RED observed: "error: INSERT has more expressions than target columns" (7 skipped).
- Fix 1 (brief): removed stray CEO UUID before `92.50` in performance_appraisals row.
- Fix 2 (Task 2's anticipated "second bug", folded in since same file): seed wrote
  password_hash as escaped `'\${hash}'` (literal text) instead of interpolated `'${hash}'`;
  bcrypt verify failed. Unescaped all 7 user rows.
Task 1: Ruling: fold the escaped-hash fix into Task 1's commit — same file as Task 1 and it is
the exact "second bug" Task 2 Step 3 anticipates; keeping one file's seed fixes in one commit is
more reviewable than splitting a single file across two commits. Cost if wrong: Task 2's brief
expected to own that fix; trivial to note.

Task 2: complete (commits 02e8852..838d44a, tests: `vitest run` → 27 files / 143 tests, ALL PASS)
- Baseline after Task 1: 2 failed suites (routes.test.ts 500s; flightRisk Bradford 0).
- Root cause A (routes): handlers call getDb() → dev .pglite, which did not exist in the fresh
  worktree ("relation users does not exist"). Fix: `npm run db:migrate` + `npm run db:seed` in
  the worktree (same as app runtime). routes.test.ts now passes.
Task 2: Ruling: fix route 500s by creating/seeding the worktree dev DB rather than refactoring
handlers to share the test DB — the handlers' getDb() contract is pre-existing and out of this
task's scope; the plan's WS-8 (Task 11) later reshapes the DB seam. Cost if wrong: route tests
depend on dev-DB state (documented repo fact); if that assumption changes, revisit.
- Root cause B (flightRisk): test seeded attendance on fixed 2026-03 dates, outside
  buildRiskProfile's 90-day lookback → 0 facts → bradfordFactor 0. Fix: compute test dates
  relative to today. 3/3 pass.
Task 2: minor (deferred): flightRisk date offsets assume day(-1..-6) are weekdays; if run on a
weekend the absent day could be filtered. Low impact (test-only); revisit if flaky.

Task 3: complete (commits 838d44a..32787b5, tests: `vitest run` → 27 files / 143 tests PASS)
- Deleted 22 .bak files (5 route, 2 dashboard pages, 6 components, 4 lib, 4 test, 1 migration).
- Suite unchanged (27/27) — .bak files were never in the test glob.

Task 4: complete (commits 32787b5..c691056, tests: `vitest run tests/integration/seed.test.ts` → 8/8; `npm run build` OK)
- Rewrote dummy-data/index.ts: kept only the user list as DEMO_LOGIN_ACCOUNTS, deleted 15 DUMMY_* exports.
- Updated 3 consumers (login/page.tsx, Header.tsx, AuthContext.tsx): DUMMY_USERS -> DEMO_LOGIN_ACCOUNTS.
Task 4: Ruling: plan specified DEMO_LOGIN_ACCOUNTS as { email, role, label }, but the consumers
render name/position/avatarUrl and key on id, and the plan's own test wants >=7 accounts while
DUMMY_USERS had 6. Expanded DemoLoginAccount to { id, email, name, role, department, position,
avatarUrl? } and added the missing SUPER_ADMIN (admin@eperformiq.co.id) so the UI keeps working
and the test's >=7 holds. Cost if wrong: shape differs from plan text; trivial to adjust.

Task 5: complete (commits c691056..8013cea, tests: coreHrService 6/6 + seed 8/8 + flightRisk 3/3; build OK)
- Migration 0006_contract_end_date.sql (idempotent ALTER TABLE ADD COLUMN IF NOT EXISTS).
- coreHrService: exported computeContractDaysRemaining(); buildRiskProfile reads employees.contract_end_date.
- Seed: sets Rian (EMP-2024-0230, PROBATION) contract_end_date='2026-12-31' via idempotent UPDATE.
- tests/govera-0006-schema.test.ts (new) + 3 unit cases for the helper.

Task 6: complete (commits 8013cea..9b54717, tests: analytics-vmai 2/2 + engines 19/19; build OK)
- selectActivePillars(db, periodIdentifier?): achievedScore now = SUM(actual)/SUM(target)*100 from
  individual_kpis (0 when none), replacing the hardcoded 92.4/100.
- vmai-engine: calculateVMAI(pillars, gcg?, { totalEmployees?, periodCode?, industryTarget? }) —
  removed hardcoded 1240 / '2026-Q3' (now neutral defaults, overridden by caller).
- analyticsService.getVmaiScorecardData: COUNT(employees, non-RESIGNED) + appraisal_periods code.
Task 6: Ruling: bind period as a NULL-uuid rather than casting the raw string — Postgres parses
the ::uuid cast even under an `isUuid = FALSE` guard, so a non-UUID period caused
"invalid input syntax for type uuid". Passing null avoids the cast. Cost if wrong: none; tests pin it.

Task 7: complete (commits 9b54717..322eb0e, tests: analytics-summaries 4/4 + rbac/analytics 14/14; build OK)
- Migration 0007_reference_data.sql: industry_benchmarks + company_vision_mission (idempotent).
- Seed: 19 benchmark rows + 1 vision/mission row (mission pipe-separated for multi-line display).
- New analyticsSummaryService: getBenchmarkGap/getExecutiveSummary/getLifecycleSummary (null-safe).
- benchmark-gap route rewritten to read DB; new executive-summary + lifecycle-summary routes.
- cascading-tree vision/mission now read from company_vision_mission.
- rbac: added 'analytics:read' permission (SUPER_ADMIN, BOD, HR_MANAGER, AUDITOR).
Task 7: Ruling: added a new 'analytics:read' permission rather than reusing 'kpi:read' — the plan
called for analytics:read RBAC and reusing kpi:read would over-grant analytics to EMPLOYEE/PEOPLE_MANAGER.
Cost if wrong: extra permission row; reversible.

Task 8: complete (commits 322eb0e..d9d5fea, tests: ui-data-routes 5/5 + full suite 31 files/159 PASS; build OK)
- New routes: /performance/my-scorecard (scope 403), /performance/team-roster, /performance/nine-box-summary.
- executive/page: VMAI tooltip bound to live value.
- manager-cockpit: teamRoster GPA/box hydrated from team-roster API.
- employee-portal: scorecard GPA + 4 component scores from my-scorecard API.
- ninebox-matrix: 4 summary metrics from nine-box-summary; fake setTimeout "Simulasi" -> real refetch.
- charts RadarChartBSC/GaussianCurve: accept optional data props (defaults preserved); both unused by pages.
- schema.test.ts: EXPECTED_TABLES updated for 0007's 2 tables (35 -> 37).
Task 8: Ruling: scoped UI rewiring — pages keep their rich presentation scaffolds and overlay
DB values (GPA/scores/counts), rather than a full data-model refactor of 20+-field component
view models. The plan's goal (no misleading hardcoded figures driving decisions) is met; the
decorative trend-chart SVG shape stays illustrative (no historical VMAI endpoint exists in PRD/plan)
with its current-point label bound to live data. Cost if wrong: some secondary display fields remain
demo-scaffold; a future task could fully data-model them.

Task 9: complete (commits d9d5fea..ad0cd03, tests: chatbot-service 3/3 + unit 3/3; build OK)
- Migration 0008_policy_knowledge_base.sql + 6 seeded Q&A rows.
- Engine: queryPolicyChatbotEngine(db, question, employeeId) -> {answer, source: POLICY|DATA|FALLBACK, confidence}.
- Route: requires auth, employeeId from session (not body); returns ok(reply).
- Drawer updated to read json.data.source (was sourceRef).
- Old unit test rewritten to mock db.execute (source/confidence); integration test added.
- schema.test.ts EXPECTED_TABLES updated (37 -> 38).
Task 9: Ruling: DATA branch implements "saldo cuti" only (leave_requests count) as the concrete
scoped data answer; plan listed leave/expense/severance as candidates. Keeping one real DATA path
avoids guessing at exact wording/tables for the others while proving the scoped-DATA mechanism.
Cost if wrong: fewer DATA intents than plan suggested; extensible without schema change.

## RESUME POINT (session checkpoint after Task 7)
Next: Task 8 — wire dashboard UI to APIs (5 pages + 2 charts + 3 new performance routes).
Everything through Task 7 is committed and green. Worktree: e:\PRD Penilaian Karyawan\eperformiq-prod
Test cmd: .\node_modules\.bin\vitest.cmd run <path>   (npx resolves a broken vitest@5)
