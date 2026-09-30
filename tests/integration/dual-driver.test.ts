import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed } from '@/lib/db/seed';

const HAS_PG = !!process.env.DATABASE_URL;

describe('dual-driver', () => {
  it('PGlite: migrasi + seed berjalan pada klien in-memory', async () => {
    const client = new PGlite();
    await runMigrations(client as any);
    await runSeed(client as any);
    const r = await client.query<{ c: string }>('SELECT count(*)::text AS c FROM users');
    expect(Number(r.rows[0].c)).toBeGreaterThan(0);
    await client.close();
  });

  it.skipIf(!HAS_PG)('PostgreSQL server: migrasi + seed berjalan pada DATABASE_URL', async () => {
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.DATABASE_URL!);
    const client = {
      query: async (q: string, p?: any[]) => ({ rows: await sql.unsafe(q, p ?? []) }),
      exec: async (q: string) => { await sql.unsafe(q); },
    };
    await runMigrations(client as any);
    await runSeed(client as any);
    const rows = (await sql.unsafe('SELECT count(*)::text AS c FROM users')) as any;
    expect(Number(rows[0].c)).toBeGreaterThan(0);
    await sql.end();
  });
});
