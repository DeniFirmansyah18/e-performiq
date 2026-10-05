# WS-5: Hardening & UX Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining UX/compliance gaps: surface the interview meeting link to candidates, add a public certificate-verification page, and document the new architecture decisions.

**Architecture:** Three small, independent changes on top of existing services. (1) The candidate timeline/status payload already reads `interview_schedules`; add the `meeting_url` + `scheduled_at` to the returned stage and render it on `/careers/status`. (2) Add a Next.js page `/certificates/verify/[code]` that calls the existing `GET /api/v1/certificates/verify/:code`. (3) Write ADRs + a source-attribution doc.

**Tech Stack:** Next.js 14, existing services, Vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-04-production-gap-closure-design.md` (§ WS-5).

## Global Constraints

- No schema changes.
- `meeting_url` may be null → UI must handle absence gracefully.
- Public verify page is read-only, no auth.
- Commit per task; `npm run db:reset` before full suite.

## Review Focus

- **Interview with no meeting link** → candidate sees status + "jadwal menyusul", not a broken link.
- **Invalid certificate code** → page shows a clear "tidak ditemukan" state (not 500).
- **Candidate with no interview scheduled** → timeline renders without errors.

---

### Task 1: Surface interview meeting link to the candidate

**Files:**
- Modify: `src/lib/services/timelineService.ts` (join `interview_schedules` → include `meetingUrl`, `scheduledAt`, `status` on the INTERVIEW stage)
- Modify: `src/app/careers/status/page.tsx` (render the link/schedule when present)
- Test: `tests/integration/timelineService.test.ts` (add assertion)
- Verify route: `src/app/api/v1/careers/timeline/[applicationNo]/route.ts` should pass it through unchanged.

**Interfaces:**
- Produces: timeline INTERVIEW stage gains `{ meetingUrl: string | null; scheduledAt: string | null; interviewerName?: string | null }`.

- [x] **Step 1: Write failing test** — schedule an interview (`interview_schedules` insert with `meeting_url`) for an application, then assert `getTimelineByApplicationNo` returns the interview stage with `meetingUrl` set.
- [x] **Step 2: Run to verify failure.**
- [x] **Step 3: Implement** — extend the timeline query/mapping to LEFT JOIN `interview_schedules` on `application_id`; include the fields; render on the status page as a link (`target="_blank" rel="noopener"`) with the scheduled datetime; show "Jadwal wawancara menyusul" when null.
- [x] **Step 4: Run to verify pass.**
- [x] **Step 5: Commit**

```bash
git add src/lib/services/timelineService.ts src/app/careers/status/page.tsx tests/integration/timelineService.test.ts
git commit -m "feat(careers): show interview meeting link & schedule on candidate timeline"
```

---

### Task 2: Public certificate verification page

**Files:**
- Create: `src/app/certificates/verify/[code]/page.tsx`
- Test: browser verification (page is a thin client over the existing API)

**Interfaces:**
- Consumes: `GET /api/v1/certificates/verify/:code` (existing) → `{ data: { valid, certificate? } }`.
- Produces: a public page rendering valid/invalid state with certificate holder, course, issue date.

- [x] **Step 1: Implement the page** — client component reading `params.code`, fetching the verify API, showing a green "Sertifikat Valid" card (holder, course, date, issuer) or a red "Tidak Ditemukan/Tidak Valid" state. No auth.
- [x] **Step 2: Browser verify** — open `/certificates/verify/<known-code>` from a seeded certificate → valid; random code → not found.
- [x] **Step 3: `npm run build` + commit**

```bash
git add src/app/certificates
git commit -m "feat(certificates): public verification page /certificates/verify/[code]"
```

---

### Task 3: ADRs + source attribution + README

**Files:**
- Create: `docs/decisions/016-employee-self-registration.md`
- Create: `docs/decisions/017-irt-psychometric-scoring.md`
- Create: `docs/decisions/018-ai-technical-test-generation.md`
- Create: `docs/SOURCES.md` (OSS attribution: IRT reference, IPIP items)
- Modify: `README.md` (link the new pages; note rate-limit follow-up)

- [x] **Step 1: Write ADR-016** — decision: public self-registration + email verify + HR approval; consequences (attack surface, mitigation: unique email, token expiry, HR gate; **rate limiting deferred** — tracked).
- [x] **Step 2: Write ADR-017** — decision: IRT (2PL/3PL, EAP) for psychometric; parameters seeded heuristically; calibration from real data = future.
- [x] **Step 3: Write ADR-018** — decision: AI-generated technical questions, HR-approved (DRAFT gate); AI advisory.
- [x] **Step 4: Write `docs/SOURCES.md`** — cite the IRT book (aswinjanuarsjaf/Buku_IRT) and IPIP items (public domain), noting usage.
- [x] **Step 5: Run full suite + build, commit**

```bash
npm run db:reset; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run --reporter=basic
npm run build
git add docs README.md
git commit -m "docs: ADRs for self-registration, IRT, AI tech-test; OSS sources; README"
```

---

## Self-Review

**Spec coverage (§ WS-5):** interview link (Task 1), public verify page (Task 2), ADRs + OSS docs + README (Task 3). ✓
**Placeholder scan:** all tasks have concrete files/commands; code shown where risky (Task 1 mapping).
**Type consistency:** timeline stage field names (`meetingUrl`/`scheduledAt`) used consistently.
**Review Focus → tests:** no meeting link (Task 1 null-handling), invalid cert code (Task 2), no interview scheduled (Task 1 LEFT JOIN tolerance). ✓
