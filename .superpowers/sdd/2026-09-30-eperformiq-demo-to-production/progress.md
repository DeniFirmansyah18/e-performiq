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
