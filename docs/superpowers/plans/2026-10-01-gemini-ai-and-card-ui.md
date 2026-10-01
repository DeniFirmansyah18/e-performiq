# Gemini AI Integration + Card UI (No Sidebar) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Gemini (per-feature "Analisis AI" + a global chat agent) server-side, and replace the sidebar with a top-bar dropdown nav while turning each dashboard's content into a click-to-open card grid.

**Architecture:** A server-only `aiService` calls the Gemini REST endpoint via `fetch` (no SDK) with a graceful fallback when unconfigured, exposed through `/api/v1/ai/*`. The dashboard shell drops `Sidebar`, adds `NavMenu` + `AiChatDrawer` to the existing dark `Header`, and each dashboard renders `FeatureCard`s in a responsive grid that expand into panels containing the existing feature content plus an `AiAnalyzePanel`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Drizzle/PGlite, Vitest, Tailwind, `zod`. Gemini via REST `generativelanguage.googleapis.com`.

**Spec:** `docs/superpowers/specs/2026-10-01-gemini-ai-and-card-ui-design.md`

## Global Constraints

- Gemini is called **server-side only** (`aiService`, route handlers). Never call it from a client component. Key from `process.env.GEMINI_API_KEY`; model from `process.env.GEMINI_MODEL` (default `gemini-2.0-flash`).
- Unconfigured (no key) => return `{ configured: false, ... }` with a friendly message and HTTP **200** (never 500).
- Routes: `getAuthSession` -> `assertCan(session, 'ai:read')` -> `ok(...)`; errors via `problem(err, instance)` (RFC 7807).
- New permission `ai:read` added to `src/lib/auth/rbac.ts` for all roles.
- Do NOT change existing feature logic or existing API contracts; the card UI only re-parents existing content into panels.
- Sidebar removed: delete `src/components/navigation/Sidebar.tsx` and its import in `dashboard/layout.tsx`. Keep `Header` (dark top bar).
- Tests: run `npm run db:reset` before the suite when schema changes; test cmd `node_modules/.bin/vitest.cmd run <path>`; build `npm run build`. `fileParallelism:false` already set.
- Card grid: responsive 3/2/1 columns; cards are real `<button>` elements (keyboard accessible).

## Review Focus

Inputs/conditions the spec implies but no single task's happy path covers - each has a test in its owning task:

1. **No API key** must yield `configured:false` with HTTP 200 on both analyze and chat. (Task 3, Task 4)
2. **Gemini HTTP error** (bad key / quota) must return a friendly message, not a crash. (Task 1)
3. **Unauthenticated** AI calls return 401. (Task 3, Task 4)
4. **Unknown feature id** to `/ai/analyze` must be handled (400 or a generic summary), not throw. (Task 2, Task 3)
5. **Sidebar removal** must not break navigation - all role-gated links remain reachable from the top-bar menu. (Task 4, Task 5)

---

## WS-1 - Gemini Service & API

### Task 1: aiService (REST fetch + config guard)

**Files:**
- Create: `src/lib/services/aiService.ts`
- Test: `tests/unit/aiService.test.ts` (new)

**Interfaces:**
- Produces: `isAiConfigured(): boolean`; `generateContent(prompt: string, opts?: { maxOutputTokens?: number; temperature?: number }): Promise<{ text: string; configured: boolean; error?: string }>`.
- Consumes: `process.env.GEMINI_API_KEY`, `process.env.GEMINI_MODEL`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/aiService.test.ts` (mocks global `fetch`):
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('aiService', () => {
  const OLD = process.env;
  beforeEach(() => { vi.resetModules(); process.env = { ...OLD }; });
  afterEach(() => { process.env = OLD; vi.restoreAllMocks(); });

  it('isAiConfigured false tanpa GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    const { isAiConfigured } = await import('@/lib/services/aiService');
    expect(isAiConfigured()).toBe(false);
  });

  it('generateContent mengembalikan configured:false tanpa kunci (tanpa fetch)', async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({} as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.configured).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generateContent memanggil Gemini & mengembalikan teks saat dikonfigurasi', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'insight xyz' }] } }] }),
    } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.configured).toBe(true);
    expect(r.text).toBe('insight xyz');
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });

  it('generateContent menangani error HTTP dengan pesan ramah', async () => {
    process.env.GEMINI_API_KEY = 'bad';
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.configured).toBe(true);
    expect(r.error).toBeTruthy();
    expect(r.text.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node_modules\.bin\vitest.cmd run tests/unit/aiService.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement**

```ts
export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export async function generateContent(
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number } = {}
): Promise<{ text: string; configured: boolean; error?: string }> {
  if (!isAiConfigured()) {
    return { configured: false, text: 'AI belum dikonfigurasi. Set GEMINI_API_KEY untuk mengaktifkan analisis AI.' };
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: opts.maxOutputTokens ?? 600, temperature: opts.temperature ?? 0.4 },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { configured: true, error: `Gemini error ${res.status}`, text: `Maaf, analisis AI gagal (status ${res.status}). ${String(detail).slice(0, 200)}` };
    }
    const json: any = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
    return { configured: true, text: text || 'Tidak ada keluaran dari model.' };
  } catch (e: any) {
    return { configured: true, error: e?.message ?? 'network', text: 'Maaf, gagal menghubungi layanan AI.' };
  }
}
```

- [ ] **Step 4: Verify PASS, then commit**

Run: `node_modules\.bin\vitest.cmd run tests/unit/aiService.test.ts` -> PASS.
```bash
git add -A; git commit -m "feat(ai): Gemini REST service with config guard and graceful fallback"
```

---

### Task 2: buildFeatureContext + analyzeFeature + chat

**Files:**
- Modify: `src/lib/services/aiService.ts`
- Create: `src/lib/services/aiContext.ts` (feature summary builders)
- Test: `tests/integration/aiService.test.ts` (new)

**Interfaces:**
- Produces: `buildFeatureContext(db: Db, feature: string): Promise<Record<string, unknown>>` (reuses existing services: VMAI, summaries, learning, candidates).
- Produces: `analyzeFeature(db: Db, feature: string, role: string): Promise<{ insight: string; configured: boolean }>`.
- Produces: `chat(db: Db, messages: { role: 'user' | 'model'; content: string }[], role: string): Promise<{ reply: string; configured: boolean }>`.
- Supported `feature` ids: `executive | hr | manager | employee | ninebox | audit | learning | careers`. Unknown id -> generic context (no throw).

- [ ] **Step 1: Write the failing test**

Create `tests/integration/aiService.test.ts` (uses `createTestDb()` + `runSeed`, mocks `fetch`, no key set):
- `buildFeatureContext(db, 'executive')` returns an object with numeric `vmai` (or at least keys), no throw.
- `buildFeatureContext(db, 'unknown-xyz')` returns an object (does not throw).
- No key: `analyzeFeature(db,'executive','BOD')` -> `configured:false`, `insight` non-empty.
- No key: `chat(db, [{role:'user',content:'halo'}], 'BOD')` -> `configured:false`, `reply` non-empty.

- [ ] **Step 2: Run to verify failure** -> FAIL.

- [ ] **Step 3: Implement** `aiContext.ts` (reuse `analyticsService.getVmaiScorecardData`, `analyticsSummaryService`, `learningLmsService.listCourses`, `candidateService.listCandidates`) and add `analyzeFeature`/`chat` to `aiService.ts` (Indonesian prompts; instruct to use only the provided summary).

- [ ] **Step 4: Verify PASS, then commit**

```bash
git add -A; git commit -m "feat(ai): feature context builders + analyzeFeature + chat"
```

---

### Task 3: RBAC `ai:read` + /api/v1/ai routes

**Files:**
- Modify: `src/lib/auth/rbac.ts` (add `ai:read` for all roles)
- Create: `src/app/api/v1/ai/status/route.ts`, `src/app/api/v1/ai/analyze/route.ts`, `src/app/api/v1/ai/chat/route.ts`
- Test: `tests/api/ai-routes.test.ts` (new)

**Interfaces:**
- Produces: `GET /ai/status` -> `{ configured }`; `POST /ai/analyze` body `{ feature }` -> `{ insight, configured }`; `POST /ai/chat` body `{ messages }` -> `{ reply, configured }`.

- [ ] **Step 1: Write the failing tests**

`tests/api/ai-routes.test.ts`:
- `GET /ai/status` 401 without session; 200 `{ configured:false }` (no key) with cookie.
- `POST /ai/analyze` 401 without session; 200 `{ configured:false }` with cookie (no key); body missing `feature` -> 400.
- `POST /ai/chat` 200 `{ configured:false }` with cookie; empty messages -> 400.

- [ ] **Step 2: Run to verify failure** -> FAIL.

- [ ] **Step 3: Add permission + implement routes** (each `getAuthSession` -> `assertCan('ai:read')` -> service -> `ok()`; `zod` bodies).

- [ ] **Step 4: Verify PASS + commit**

```bash
git add -A; git commit -m "feat(ai): ai:read permission + status/analyze/chat routes"
```

---

## WS-2 - Shell: remove sidebar, top-bar nav + AI drawer

### Task 4: NavMenu (role-aware dropdown) + remove Sidebar

**Files:**
- Create: `src/components/navigation/NavMenu.tsx`
- Modify: `src/components/navigation/Header.tsx` (render `NavMenu`)
- Modify: `src/app/dashboard/layout.tsx` (remove `<Sidebar/>`)
- Delete: `src/components/navigation/Sidebar.tsx`
- Test: build + browser smoke (nav links present, role-gated)

**Interfaces:**
- Consumes: the role->portal/module map (moved from `Sidebar.tsx`), `useAuth().activeRole`, `UserGuideModal`.

- [ ] **Step 1: Grep for Sidebar imports/usages first** (`grep_search "Sidebar"`) to ensure no test imports it.

- [ ] **Step 2: Create NavMenu** with two `<button>` dropdowns ("Portal", "Modul") + bottom items (Panduan -> opens `UserGuideModal`, Settings, GCG Policy Archive). Use the SAME role arrays as the old Sidebar:
  - Portals: executive `['BOD','SUPER_ADMIN','AUDITOR','ASSESSOR']`, hr-command `['HR_MANAGER','SUPER_ADMIN','BOD','ASSESSOR']`, manager-cockpit `['PEOPLE_MANAGER','SUPER_ADMIN','HR_MANAGER','ASSESSOR']`, employee-portal (all roles).
  - Modules: ninebox `['BOD','HR_MANAGER','PEOPLE_MANAGER','SUPER_ADMIN','ASSESSOR']`, offboarding (link to `/dashboard/hr-command?tab=offboarding`) `['HR_MANAGER','SUPER_ADMIN','BOD']`, audit `['AUDITOR','BOD','SUPER_ADMIN','HR_MANAGER','ASSESSOR']`.
  - Keyboard: Escape closes, click-outside closes, `aria-expanded` set.

- [ ] **Step 3: Wire NavMenu into Header between brand and search.** Keep existing search/period/notif/profile.

- [ ] **Step 4: Remove `<Sidebar/>` from `src/app/dashboard/layout.tsx` and delete `Sidebar.tsx`.** Update `main` classes so content spans full width.

- [ ] **Step 5: Build + smoke** -> `npm run build` success; open a dashboard, confirm menu lists the same links; navigate works; no sidebar present.

- [ ] **Step 6: Commit**

```bash
git add -A; git commit -m "feat(ui): remove sidebar; role-aware top-bar nav menu"
```

---

### Task 5: AiChatDrawer + header button

**Files:**
- Create: `src/components/ai/AiChatDrawer.tsx`
- Modify: `src/components/navigation/Header.tsx` (add "Tanya AI" button that opens the drawer)
- Test: build + browser smoke

**Interfaces:**
- Consumes: `POST /api/v1/ai/chat`, `GET /api/v1/ai/status`; props `{ isOpen, onClose }`.

- [ ] **Step 1: Build the drawer** (right side, `fixed`, slide-in; message list; input+kirim; local state only). On mount fetch `/ai/status`; if `configured:false`, show a clear banner "AI belum dikonfigurasi (set GEMINI_API_KEY)". Sends `{ messages: [{role:'user',content}] }`; appends `{role:'model'}` reply.

- [ ] **Step 2: Add "Tanya AI" button** to Header; render `<AiChatDrawer/>` in `dashboard/layout.tsx` (or Header) with open state.

- [ ] **Step 3: Build + smoke** -> open drawer, send message; without key shows the fallback message; no crash.

- [ ] **Step 4: Commit**

```bash
git add -A; git commit -m "feat(ai-ui): global AI agent chat drawer"
```

---

## WS-3 - Card UI + AI analyze panel

### Task 6: Card primitives (FeatureCard, FeatureGrid, ExpandablePanel, AiAnalyzePanel)

**Files:**
- Create: `src/components/ui/FeatureCard.tsx`, `src/components/ui/FeatureGrid.tsx`, `src/components/ui/ExpandablePanel.tsx`, `src/components/ai/AiAnalyzePanel.tsx`
- Test: build (type-check) + browser smoke on one page

**Interfaces:**
- Produces: `FeatureCard({ icon, title, description, metric?, tag?, onOpen })`; `FeatureGrid({ children })` (responsive 3/2/1); `ExpandablePanel({ open, title, onClose, children })`; `AiAnalyzePanel({ feature })` (calls `/ai/analyze`).

- [ ] **Step 1: Implement primitives.** `FeatureGrid`: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`. `FeatureCard`: real `<button type="button">`, hover lift, keyboard focus ring. `ExpandablePanel`: renders children in a bordered panel with a title + close button; `role="region"` + `aria-label`.

- [ ] **Step 2: Implement AiAnalyzePanel.** On mount and on "Analisis ulang", POST `/ai/analyze` `{ feature }`; show loading; render `insight`; if `configured:false` render the returned message styled as info (not error).

- [ ] **Step 3: Build** -> `npm run build` success.

- [ ] **Step 4: Commit**

```bash
git add -A; git commit -m "feat(ui): card primitives + AI analyze panel"
```

---

### Task 7: Refactor dashboards to card grid

**Files (modify each):**
- `src/app/dashboard/executive/page.tsx`
- `src/app/dashboard/hr-command/page.tsx`
- `src/app/dashboard/manager-cockpit/page.tsx`
- `src/app/dashboard/employee-portal/page.tsx`
- `src/app/dashboard/ninebox-matrix/page.tsx`
- `src/app/dashboard/audit-governance/page.tsx`
- Test: build + browser smoke per page (cards open/close; content still present)

**Interfaces:**
- Consumes: Task 6 primitives; existing page content + existing APIs (unchanged). Add an `AiAnalyzePanel feature="..."` inside each opened panel.

- [ ] **Step 1: Executive.** Wrap current sections into cards: `VMAI`, `Perspektif BSC`, `Tren Strategis`, `Succession/TARIF`. Panel for `VMAI` shows the existing VMAI content + `<AiAnalyzePanel feature="executive" />`. Keep existing fetches.

- [ ] **Step 2: HR command.** Cards: `MPP & Rekrutmen`, `Probation`, `Offboarding & Clearance`, `Learning & Certification`, `Cost & Risk`. Move existing blocks (`CostOfWorkforceCard`, `FlightRiskHeatmap`, `LearningCertificationPanel`, `RecruitmentPanel`, tables) into the matching panel. Panel gets `<AiAnalyzePanel feature="hr" />`.

- [ ] **Step 3: Manager cockpit.** Cards: `Roster Tim`, `Approval KPI`, `Evaluasi GPA`. Move existing table/modals; panel gets `feature="manager"`.

- [ ] **Step 4: Employee portal.** Cards: `Scorecard GPA`, `Learning & Development`, `Sertifikat`, `Profil Saya`, `Timesheet & Payslip`, `Pengajuan`. Move `LearningModule`, `MyProfileModal` launcher, existing scorecard + action buttons into cards/panels; panel gets `feature="employee"`.

- [ ] **Step 5: 9-Box.** Cards: `Distribusi`, `Inspection Panel`, `Simulasi`. Move existing `NineBoxGrid`/panels; panel gets `feature="ninebox"`.

- [ ] **Step 6: Audit governance.** Cards: `Prinsip TARIF`, `Metrik Kepatuhan`, `Audit Log`. Move existing table; panel gets `feature="audit"`.

- [ ] **Step 7: Build + smoke each page** -> `npm run build` success; click each card -> panel opens with content + AI block; close works; nothing lost.

- [ ] **Step 8: Commit**

```bash
git add -A; git commit -m "feat(ui): card-grid layout for all dashboards"
```

---

## WS-4 - Config, verification, ADRs

### Task 8: .env.example, ADRs 012/013, README, final verification

**Files:**
- Create: `.env.example`, `docs/decisions/012-gemini-integration.md`, `docs/decisions/013-card-ui-shell.md`
- Modify: `README.md`
- Test: full suite + build + db:reset + smoke

- [ ] **Step 1: `.env.example`** with `GEMINI_API_KEY=` and `GEMINI_MODEL=gemini-2.0-flash` (plus existing vars).

- [ ] **Step 2: ADR 012** (Gemini server-side REST, config guard/fallback, non-goals: streaming/RAG).
  **ADR 013** (sidebar removed; top-bar dropdown nav; card grid + expandable panels).

- [ ] **Step 3: README** â€” document `GEMINI_API_KEY`, the AI features, and the new card/shell layout.

- [ ] **Step 4: Full verification** â€” run `npm run db:reset`; `node_modules\.bin\vitest.cmd run` (all pass); `npm run build` (success).

- [ ] **Step 5: Commit**

```bash
git add -A; git commit -m "docs(config): .env.example, ADRs 012/013, README for AI + card UI"
```

---

## Spec Coverage Check

| Spec WS | Plan task(s) |
|---|---|
| WS-1 aiService | Task 1 |
| WS-1 context + analyze + chat | Task 2 |
| WS-1 routes + ai:read | Task 3 |
| WS-2 remove sidebar + nav menu | Task 4 |
| WS-2 AI chat drawer | Task 5 |
| WS-3 card primitives + AI panel | Task 6 |
| WS-3 dashboards to card grid | Task 7 |
| WS-4 config + verification + ADR | Task 8 |

## Execution Handoff

- **Native (inline)** if no writable subagent: implement each task TDD, commit per task, one whole-branch review at the end. (Used previously: paid gateway unavailable.)
- **Subagent-driven** if a writable model becomes available.

Order: Task 1 -> 2 -> 3 (AI backend) -> 4 -> 5 (shell) -> 6 -> 7 (cards) -> 8 (docs/verify). Tasks 4 and 7 are UI-only (build + smoke as the gate); the rest are TDD. Do not start a task whose `Consumes` are not committed.

