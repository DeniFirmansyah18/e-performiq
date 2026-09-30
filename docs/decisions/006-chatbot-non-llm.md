# ADR 006 — Governance Chatbot: Deterministic / DB-backed (non-LLM)

**Status:** Accepted (2026-09-30)
**Context:** WS-3 (Task 9) of the demo→production remediation.

## Decision
The governance/SOP chatbot answers from a seeded knowledge base
(`policy_knowledge_base`) using keyword scoring, plus a scoped **DATA** branch
that answers questions about the caller's own records (e.g. approved leave
count). It returns `{ answer, source: 'POLICY' | 'DATA' | 'FALLBACK', confidence }`.
The endpoint requires authentication; the employee id is taken from the session,
never from the request body.

## Rationale
- The previous engine was keyword if/else with no DB, no auth, and no scoping —
  a stub masquerading as a feature.
- A deterministic engine is scope-safe and needs no external model or API key,
  matching the current PGlite/single-node deployment.

## Consequences
- `queryPolicyChatbotEngine(db, question, employeeId)` replaces the arg-free
  version; the route authenticates and derives `employeeId` from the session.
- `HelpdeskChatbotDrawer` reads `data.source` (was `data.sourceRef`).

## Deferred
LLM/RAG chatbot remains out of scope (plan M-11). When added, it should extend
this engine rather than replace the scope guarantees.

## Cost if wrong
The DATA branch currently handles one concrete intent (leave balance);
additional intents are additive without schema changes.
