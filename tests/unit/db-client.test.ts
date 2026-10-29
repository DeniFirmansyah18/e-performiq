import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('klien database', () => {
  it('menyalakan PGlite dan melaporkan versi PostgreSQL', async () => {
    const client = new PGlite();
    const result = await client.query<{ version: string }>('SELECT version()');
    await client.close();

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].version).toContain('PostgreSQL');
  });

  it('mengekspor instance db dari client.ts', async () => {
    const { db } = await import('@/lib/db/client');
    expect(db).toBeDefined();
  });

    it('withNormalizedExecute menyamakan bentuk hasil kedua driver', async () => {
      const { withNormalizedExecute } = await import('@/lib/db/client');

      // postgres-js mengembalikan array polos.
      const postgresLike = withNormalizedExecute({
        execute: async () => [{ id: 'a' }, { id: 'b' }],
      });
      const fromArray = (await (postgresLike as any).execute()) as { rows: unknown[] };
      expect(fromArray.rows).toHaveLength(2);

      // PGlite mengembalikan { rows }.
      const pgliteLike = withNormalizedExecute({
        execute: async () => ({ rows: [{ id: 'c' }] }),
      });
      const fromObject = (await (pgliteLike as any).execute()) as { rows: Array<{ id: string }> };
      expect(fromObject.rows[0].id).toBe('c');

      // Objek transaksi tidak mewarisi normalisasi `db`; pembungkus inilah yang
      // menjaga `.rows[0]` tetap bekerja di dalam transaksi pada PostgreSQL.
      const txLike = withNormalizedExecute({ execute: async () => [{ id: 'tx' }] });
      expect(((await (txLike as any).execute()) as { rows: unknown[] }).rows).toHaveLength(1);
    });
  });
