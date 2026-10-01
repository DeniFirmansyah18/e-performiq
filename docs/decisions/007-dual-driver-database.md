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
**DONE (2026-10-01):** `createDb()` kini memilih driver dari `DATABASE_URL` — bila ada,
memakai `postgres-js` (`drizzle-orm/postgres-js`, `prepare:false`, `max:1` untuk serverless);
bila tidak, PGlite. `getDb()` mengembalikan adapter `SqlClient` untuk kedua driver.
Ditambah guard runtime serverless (Vercel/Lambda) yang memberi pesan jelas bila
`DATABASE_URL` kosong. Skrip `db:migrate:pg` / `db:seed:pg` menjalankan migrasi+seed ke
PostgreSQL server. Lihat juga langkah deploy di README.
