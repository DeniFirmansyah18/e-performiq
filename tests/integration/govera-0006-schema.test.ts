import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

describe('migration 0006: contract_end_date', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); });
  afterAll(async () => { await client.close(); });

  it('menambahkan kolom contract_end_date bertipe date', async () => {
    const res = await client.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'contract_end_date'`
    );
    expect(res.rows[0]?.data_type).toBe('date');
  });
});
