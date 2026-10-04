# WS-1: Production Foundation — Remove Demo & Enforce Two Logins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all demo/quick-login scaffolding so E-PerformIQ authenticates only real seeded accounts, with employee login (`/login`) and candidate login (`/careers/login`) cleanly separated.

**Architecture:** Delete `src/lib/dummy-data/` (a client-only list of display fixtures used by quick-login and a demo role switcher). The database already seeds 7 real role accounts (`src/lib/db/seed/index.ts`, `DEMO_PASSWORD = 'enterprise2026'`); document those as the dev test accounts in README instead of shipping UI buttons. `/login` stays employee-only (`eperformiq_token`); `/careers/login` + `/careers/register` stay candidate-only (`eperformiq_candidate_token`). Remove the Header demo role-switcher and inline placeholder arrays that mislead (ninebox `candidates`).

**Tech Stack:** Next.js 14 App Router, TypeScript, React 18, Vitest 2, PGlite/postgres-js dual driver.

**Spec:** `docs/superpowers/specs/2026-10-04-production-gap-closure-design.md` (§ WS-1)

## Global Constraints

- Dual-driver DB: never break PGlite (`getDb()`) or Postgres (`DATABASE_URL`); no schema change in this WS.
- Auth cookies are fixed: employee = `eperformiq_token`; candidate = `eperformiq_candidate_token`. Do not rename.
- Route handlers live under `src/app/api/v1/...`; responses use `ok/fail/problem` from `src/lib/api/response.ts`.
- Tests use Vitest 2, `fileParallelism:false`; run via `.\node_modules\.bin\vitest.cmd run <path>` (PowerShell), preceded by `npm run db:reset` for route tests touching the shared `.pglite`.
- Keep real seed accounts (7 roles, password `enterprise2026`) — those are data, not demo UI.
- Commit after every task.

## Review Focus

- **Login with a real seeded account** must still route to the correct dashboard for its role (behavior must survive demo removal).
- **Candidate login/register** must not be collaterally broken when `dummy-data` is deleted (it was never imported there, but verify).
- **`Header` must render** for every role after the switcher is removed (no dangling import / no undefined reference).
- **Build must pass** with zero references to `dummy-data` anywhere (a single leftover import breaks the whole build).
- **Logout & role display** in Header keep working (still show `currentUser.role`, still offer logout) — only the *switcher* goes.

---

### Task 1: Remove the demo role-switcher from Header

**Files:**
- Modify: `src/components/navigation/Header.tsx` (import line 6; switcher block ~lines 149-170)
- Test: `tests/integration/production-integration.test.ts` (append a static-source assertion) — OR create `tests/unit/no-demo-refs.test.ts` if the former is unrelated.

**Interfaces:**
- Consumes: `useAuth()` already exposes `currentUser`, `logout` (unchanged).
- Produces: nothing new — Header renders profile + role label + logout only.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/no-demo-refs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Kumpulkan semua file .ts/.tsx di bawah src/ (rekursif). */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe('Produksi: tidak ada referensi fitur demo', () => {
  it('tidak ada file src/ yang mengimpor dummy-data atau DEMO_LOGIN_ACCOUNTS', () => {
    const offenders = walk(join(process.cwd(), 'src')).filter((f) => {
      const t = readFileSync(f, 'utf8');
      return /dummy-data|DEMO_LOGIN_ACCOUNTS/.test(t);
    });
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/no-demo-refs.test.ts`
Expected: FAIL — offenders include `src/app/login/page.tsx` and `src/components/navigation/Header.tsx`.

- [ ] **Step 3: Remove the switcher from Header**

In `src/components/navigation/Header.tsx`, delete `import { DEMO_LOGIN_ACCOUNTS } from '@/lib/dummy-data';` and delete the entire "Beralih Role (Demo Switcher)" block (the `DEMO_LOGIN_ACCOUNTS.map(...)` list, including the "Beralih Role" label). Keep the profile card, `currentUser.role` display, and the `logout()` button. If `switchRole` from `useAuth()` becomes unused, remove it from the destructuring on line 24 but leave `useAuth` import intact.

- [ ] **Step 4: Run test to verify it passes (partially) + typecheck**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/no-demo-refs.test.ts`
Expected: still FAIL (login page still references dummy-data) — this is expected; Header is now clean. Confirm via `get_errors` that `Header.tsx` has no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/navigation/Header.tsx tests/unit/no-demo-refs.test.ts
git commit -m "refactor(header): remove demo role switcher and dummy-data import"
```

---

### Task 2: Remove quick-login from the employee login page

**Files:**
- Modify: `src/app/login/page.tsx` (import line 6; `handleRoleQuickLogin`; `handleFormLogin` user lookup line 108; quick-login render block ~line 258)
- Test: `tests/unit/no-demo-refs.test.ts` (already written)

**Interfaces:**
- Consumes: `loginWithCredentials(email, password)` from `useAuth()` (unchanged); role→dashboard mapping.
- Produces: `/login` submits only credentials; role resolved from the **login API response**, not from a client fixture.

- [ ] **Step 1: Confirm the failing test state**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/no-demo-refs.test.ts`
Expected: FAIL — `src/app/login/page.tsx` listed.

- [ ] **Step 2: Read the current login handler to capture the real role source**

Open `src/app/login/page.tsx`. Confirm `loginWithCredentials` returns a success boolean; the role is currently derived from `DEMO_LOGIN_ACCOUNTS.find(...)`. Check `src/lib/context/AuthContext.tsx` for whether `loginWithCredentials` already sets `currentUser`/`activeRole` after success (grep `loginWithCredentials`).

Run: `rg -n "loginWithCredentials|activeRole|currentUser" src/lib/context/AuthContext.tsx`
Expected: shows how the authenticated role becomes available (via context state, read after await).

- [ ] **Step 3: Rewrite the login page without demo scaffolding**

In `src/app/login/page.tsx`:
- Remove `import { DEMO_LOGIN_ACCOUNTS } from '@/lib/dummy-data';` and the `UserRole` import if now unused.
- Delete `roleMeta` (the demo label map) and `handleRoleQuickLogin`.
- In `handleFormLogin`, after `await loginWithCredentials(...)` succeeds, read the role from the auth context (the value set by the login call — e.g. `currentUser?.role` captured after the await, or the value returned/mirrored by context) and redirect using the same mapping already present. If the context sets state asynchronously, use the mapping that the API response exposes; do **not** reintroduce a client fixture.
- Delete the entire quick-login render block (`DEMO_LOGIN_ACCOUNTS.map(...)`).
- Default `password` state may stay empty string (`''`).

- [ ] **Step 4: Run test + typecheck**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/no-demo-refs.test.ts`
Expected: PASS (no offenders).
Run `get_errors` on `src/app/login/page.tsx` and `src/app/login/page.tsx`'s imports.
Expected: no errors, no unused-import warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "refactor(login): remove quick-login roles; authenticate via real credentials only"
```

---

### Task 3: Delete the dummy-data module

**Files:**
- Delete: `src/lib/dummy-data/index.ts` (and the `src/lib/dummy-data/` directory if it contains only this file)
- Test: `tests/unit/no-demo-refs.test.ts`

**Interfaces:**
- Consumes: nothing (last consumer removed in Tasks 1-2).
- Produces: nothing.

- [ ] **Step 1: Verify no remaining consumers**

Run: `rg -n "dummy-data|DEMO_LOGIN_ACCOUNTS" src`
Expected: **no output** (both consumers cleaned).

- [ ] **Step 2: Delete the module**

```bash
git rm src/lib/dummy-data/index.ts
```
If `src/lib/dummy-data/` is now empty, it disappears automatically.

- [ ] **Step 3: Run the full static test + build**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/no-demo-refs.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: `✓ Compiled successfully` (no module-not-found for `@/lib/dummy-data`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete unused dummy-data module"
```

---

### Task 4: Remove misleading inline placeholder data (ninebox + hr-command)

**Files:**
- Modify: `src/app/dashboard/ninebox-matrix/page.tsx` (`QUADRANTS` inline `candidates` arrays ~lines 68-330)
- Modify: `src/app/dashboard/hr-command/page.tsx` (default candidate form / placeholder object, if present)
- Test: manual browser verification (no unit test — this is UI data wiring; covered by existing dashboard route tests + build)

**Interfaces:**
- Consumes: existing ninebox API/repository (grep for the route that already feeds the matrix, e.g. `src/app/api/v1/.../ninebox*` or dashboard aggregation).
- Produces: page renders candidates from the API (may be empty state), not from a hardcoded array.

- [ ] **Step 1: Identify the real data source**

Run: `rg -n "ninebox|nine_box|QUADRANTS" src/app/api src/lib/services src/lib/repositories`
Expected: locate the endpoint/service that should supply quadrant candidates. If **none** exists (data truly never wired), STOP and note it — the minimal production fix is to replace the hardcoded arrays with an empty-state render, and file wiring the real query as a follow-up in WS-5. Do not fabricate data.

- [ ] **Step 2: Replace inline arrays**

If a data source exists: fetch it (mirror the pattern used by `hr-command/page.tsx` or `executive/page.tsx`) and populate `QUADRANTS[].candidates` from it. If no source exists: initialize `candidates: []` for every quadrant and render the existing empty-state (add a small "Belum ada data penilaian" message if none exists), so the page no longer shows fake names.

- [ ] **Step 3: Browser verify**

Start dev (`npm run dev`), open `/dashboard/ninebox-matrix` as an authenticated HR/BOD user, confirm no fake candidate names appear (either real data or empty state), and the page has no console errors. Same check for `/dashboard/hr-command`.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ninebox-matrix/page.tsx src/app/dashboard/hr-command/page.tsx
git commit -m "chore(dashboard): remove hardcoded placeholder candidate data"
```

---

### Task 5: Document dev test accounts in README (replaces quick-login discoverability)

**Files:**
- Modify: `README.md` (add a "Akun Uji (Development)" section)
- Test: none (docs)

**Interfaces:**
- Consumes: `src/lib/db/seed/index.ts` values (`DEMO_PASSWORD = 'enterprise2026'`, 7 role emails).
- Produces: documented path for developers to log in without demo buttons.

- [ ] **Step 1: Read the seed account list**

Run: `rg -n "email:|DEMO_PASSWORD" src/lib/db/seed/index.ts`
Expected: 7 emails + password constant.

- [ ] **Step 2: Add the README section**

Add under a setup/login heading:

```markdown
### Akun Uji (Development)

Setelah `npm run db:reset`, gunakan akun seed berikut (halaman **/login** karyawan):

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | admin@eperformiq.co.id | enterprise2026 |
| BOD (CEO) | hendra.gunawan@eperformiq.co.id | enterprise2026 |
| HR Manager | siti.nurhaliza@eperformiq.co.id | enterprise2026 |
| People Manager | danu.tech@eperformiq.co.id | enterprise2026 |
| Employee | budi.pratama@eperformiq.co.id | enterprise2026 |
| Auditor | bambang.audit@eperformiq.co.id | enterprise2026 |
| Assessor | aris.assessor@eperformiq.co.id | enterprise2026 |

Kandidat mendaftar/login via **/careers/register** dan **/careers/login** (cookie terpisah).
```

(Verify the emails exactly match the seed before committing — adjust the table if any differ.)

- [ ] **Step 3: Run the full test suite + build**

Run: `npm run db:reset`, then `$env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run --reporter=basic`
Expected: all suites pass (no test referenced removed demo code).
Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): document dev seed accounts after demo removal"
```

---

## Self-Review

**Spec coverage (§ WS-1):**
- Hapus `dummy-data` + impornya → Tasks 2, 3. ✓
- Hapus quick-login role di `/login` → Task 2. ✓
- Hapus role-switcher di Header → Task 1. ✓
- Hapus inline placeholder (ninebox/hr-command) → Task 4. ✓
- Akun uji via seed & dokumentasi → Task 5. ✓
- 2 login tegas (`/login` vs `/careers/login`) → preserved; Task 2 keeps employee-only, candidate routes untouched. ✓

**Placeholder scan:** No TBD/TODO; every code step has real code or exact commands; Task 4 has an explicit branch (source exists vs not) with a concrete action for each.

**Type consistency:** `walk()`/`no-demo-refs` self-contained; Header uses existing `currentUser`/`logout`; login uses existing `loginWithCredentials`.

**Review Focus → tests:** role routing after removal (Task 2 Step 3 maps role from context/API); candidate login not broken (Task 3 Step 1 grep + full suite Task 5 Step 3); Header renders per role (Task 1 Step 4 typecheck + build); build zero refs (Task 3 Step 3 build); logout/role display retained (Task 1 Step 3 explicit). All covered.
