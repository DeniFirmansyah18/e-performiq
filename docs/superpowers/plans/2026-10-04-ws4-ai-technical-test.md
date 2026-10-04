# WS-4: AI-Generated Technical Test Bank (40%) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR generate technical MCQ questions for a job's TECHNICAL assessment template with AI, based on the job's required skills and level, then review/approve them before candidates see them.

**Architecture:** A service `technicalTestGenerator.ts` builds a strict-JSON prompt from `job_postings.required_skills` + education/level, calls `aiService.generateContent`, parses tolerant JSON, and inserts questions into `assessment_questions` (type `MCQ`) for the position's active TECHNICAL template with a DRAFT flag. HR approves via a route that flips the flag so the question becomes eligible. Best-effort: if AI is unconfigured, HR retains the existing manual path.

**Tech Stack:** Next.js 14, Drizzle `sql`, `aiService.generateContent` (Gemini/Groq/OpenRouter), Vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-04-production-gap-closure-design.md` (§ WS-4).

## Global Constraints

- AI is best-effort: on any failure, return a friendly result and never throw a 500.
- Questions inserted as `is_active = FALSE` (DRAFT) until HR approves → then `is_active = TRUE`.
- No new table needed IF `assessment_questions` already has an active/approval column; otherwise add column via migration `0021_question_approval.sql` (verify first with `rg "is_active" src/lib/db/migrations/0012_assessment_engine.sql`).
- HR-only routes; audit each generate/approve action.
- Commit per task; `npm run db:reset` before full suite.

## Review Focus

- **AI returns non-JSON / markdown-fenced JSON** → tolerant parser extracts the object; on total failure, return `{ generated: 0 }` (no crash).
- **Job with no `required_skills`** → friendly 4xx ("posisi belum punya kualifikasi").
- **Duplicate generation** → does not corrupt existing questions (only adds DRAFTs).
- **Approving a non-existent question** → 404, not 500.
- **Unapproved (DRAFT) questions** → never appear to candidates.

---

### Task 1: `technicalTestGenerator` service

**Files:**
- Create: `src/lib/services/technicalTestGenerator.ts`
- Test: `tests/integration/technicalTestGenerator.test.ts`

**Interfaces:**
- Produces:
  - `generateTechnicalQuestions(db, opts: { positionId: string; count?: number; difficulty?: 'EASY'|'MEDIUM'|'HARD'; language?: 'id'|'en' }): Promise<{ generated: number; questionIds: string[]; aiUsed: boolean }>`
  - `approveQuestion(db, questionId: string, opts: { approvedBy: string }): Promise<{ ok: true }>`
  - `listDraftQuestions(db, positionId: string): Promise<Array<{ id; prompt; options; correctKey; difficulty }>>`
- Consumes: `generateContent`/`isAiConfigured` from `aiService`; `sql`; `BusinessRuleError`.

- [ ] **Step 1: Write failing tests** (mock AI by `vi.mock('@/lib/services/aiService')`):

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

vi.mock('@/lib/services/aiService', () => ({
  isAiConfigured: () => true,
  generateContent: vi.fn(async () => ({
    configured: true,
    text: JSON.stringify({ questions: [
      { prompt: 'Apa kompleksitas bubble sort?', options: { A: 'O(n)', B: 'O(n^2)', C: 'O(log n)', D: 'O(1)' }, correctKey: 'B', difficulty: 'MEDIUM' },
    ] }),
  })),
}));

import { generateTechnicalQuestions, approveQuestion, listDraftQuestions } from '@/lib/services/technicalTestGenerator';

describe('WS-4 AI tech-test generator', () => {
  let client: PGlite; let db: any; let posId: string;
  beforeAll(async () => {
    ({ client, db } = await createTestDb()); await runSeed(client);
    posId = (await client.query(`SELECT id FROM job_positions LIMIT 1`)).rows[0].id as string;
  });
  afterAll(async () => { await client.close(); });

  it('generate menyimpan soal DRAFT + kembalikan jumlah', async () => {
    const r = await generateTechnicalQuestions(db, { positionId: posId, count: 1 });
    expect(r.generated).toBeGreaterThanOrEqual(1);
    const drafts = await listDraftQuestions(db, posId);
    expect(drafts.length).toBeGreaterThanOrEqual(1);
  });

  it('approve mengaktifkan soal', async () => {
    const drafts = await listDraftQuestions(db, posId);
    await approveQuestion(db, drafts[0].id, { approvedBy: 'hr' });
    const active = (await client.query(`SELECT is_active FROM assessment_questions WHERE id=$1::uuid`, [drafts[0].id])).rows[0];
    expect(active.is_active).toBe(true);
  });

  it('posisi tanpa skill → error ramah', async () => {
    await expect(generateTechnicalQuestions(db, { positionId: '00000000-0000-4000-8000-000000000000' }))
      .rejects.toThrow(/kualifikasi|posisi/i);
  });
});
```

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** — load job posting (`required_skills`, `min_education`, `position_title`); if empty skills → `BusinessRuleError`. Build a strict JSON prompt (schema: `{ questions: [{ prompt, options:A..D, correctKey, difficulty }] }`, language selectable). Call `generateContent`. Tolerant parse (`safeJsonParse`-style: strip fences, first `{`..last `}`). Find the active TECHNICAL template for the position (or create one). Insert each question with `is_active=FALSE`, `type='MCQ'`, `options` JSON, `correct_key`. Return ids.
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/services/technicalTestGenerator.ts tests/integration/technicalTestGenerator.test.ts
git commit -m "feat(service): AI technical-test generator (DRAFT questions per position)"
```

---

### Task 2: HR routes — generate + approve + list drafts

**Files:**
- Create: `src/app/api/v1/recruitment/assessments/generate-technical/route.ts` (POST)
- Create: `src/app/api/v1/recruitment/assessments/questions/[id]/approve/route.ts` (POST)
- Create: `src/app/api/v1/recruitment/assessments/questions/drafts/route.ts` (GET ?positionId=)
- Test: `tests/api/technical-test-routes.test.ts`

- [ ] **Step 1: Write failing route tests** (HR session; assert 200 + shape; assert 401 without session).
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** with the HR guard pattern (from `src/app/api/v1/recruitment/**`), Zod body `{ positionId, count?, difficulty?, language? }`, call the service, `ok(...)`; map `BusinessRuleError` → `problem`.
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/recruitment/assessments tests/api/technical-test-routes.test.ts
git commit -m "feat(api): HR routes for AI technical test generation, drafts, approval"
```

---

### Task 3: UI — HR generation & review panel

**Files:**
- Modify: the assessments/learning governance panel (grep where `RecruitmentPanel`/`JobPostingManager` mount) to add a "Tes Teknis" tab, OR create `src/components/governance/TechnicalTestPanel.tsx` and mount it.
- Test: browser verification.

- [ ] **Step 1:** Add a panel: select position → "Generate soal (AI)" (count, difficulty, language) → list DRAFT questions with edit/approve/reject.
- [ ] **Step 2:** Browser verify generate → approve → the question becomes eligible for candidates.
- [ ] **Step 3:** `npm run build` + commit.

```bash
git add src/components/governance src/app/dashboard
git commit -m "feat(ui): HR panel for AI technical test generation and review"
```

---

## Self-Review

**Spec coverage (§ WS-4):** generator (Task 1), HR routes incl. approve (Task 2), UI review (Task 3), manual fallback preserved (service is additive), DRAFT→approved gate (Tasks 1-2). ✓
**Placeholder scan:** Tasks 2-3 mirror existing patterns (named); Task 1 shows real test code. Acceptable.
**Type consistency:** service signatures match route usage. ✓
**Review Focus → tests:** non-JSON AI (tolerant parse in Task 1 impl; add a test with fenced JSON), no skills (test 3), duplicates (additive insert), 404 approve, DRAFT never shown (Task 1 test asserts is_active FALSE before approve). ✓
