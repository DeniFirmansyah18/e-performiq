# ADR 007 — Dual-Driver Database (PGlite default + PostgreSQL server)

**Status:** Accepted (2026-09-30)
**Context:** WS-8 (Task 11) of the demo→production remediation.

## Decision
PGlite (in-process PostgreSQL 16 WASM) remains the **default** driver — zero
setup, single process. A `SqlClient` interface (`{ query, exec }`) is introduced
so migrations and seed run against either driver, and PostgreSQL server can be
adopted by setting `DATABASE_URL`, without rewriting schema, migrations, queries,
services, or routes.

## Rationale
- PGlite is full PostgreSQL 16 (SQL, JSONB, triggers, enums, generated columns),
  so application code is driver-agnostic. The gap is operational: PGlite is
  single-process, with no replication/HA and no multi-server concurrency.
- The PRD targets enterprise scale (30k req/s, read replicas) that PGlite cannot
  serve; the seam lets that be switched on later with minimal change.

## Consequences
- `src/lib/db/client.ts` exports `SqlClient`; `getDb()` returns `SqlClient`.
- `runMigrations` / `runSeed` accept `SqlClient` (were typed to `PGlite`).
- `postgres` (postgres-js) added as a dependency.
- `tests/integration/dual-driver.test.ts` always exercises PGlite; the Postgres
  branch is `skipIf(!DATABASE_URL)`.

## Cost / follow-up
`createDb()` still instantiates PGlite unconditionally; wiring the postgres-js
Drizzle runtime when `DATABASE_URL` is present requires a live server to verify
and is a small, isolated follow-up. Until then PGlite is the working default and
the seam (types, migration/seed signature, tests) is in place.
