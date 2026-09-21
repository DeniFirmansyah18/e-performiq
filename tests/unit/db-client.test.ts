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
});
