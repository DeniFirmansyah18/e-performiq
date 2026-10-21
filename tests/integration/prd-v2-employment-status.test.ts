import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('PRD v2 — status kepegawaian', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('employees punya employment_status default PROBATION', async () => {
    const res = await db.execute(`SELECT employment_status FROM employees WHERE id = '${BUDI}'`);
    expect(res.rows[0].employment_status).toBe('PROBATION');
  });

  it('riwayat menolak perubahan ke status yang sama', async () => {
    await expect(
      db.execute(`INSERT INTO employment_status_history
        (employee_id, previous_status, new_status, effective_date)
        VALUES ('${BUDI}', 'PROBATION', 'PROBATION', CURRENT_DATE)`),
    ).rejects.toThrow(/check constraint/i);
  });
});
