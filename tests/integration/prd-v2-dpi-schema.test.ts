import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('PRD v2 — DPI & snapshot', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('view rekap mengagregasi snapshot per bulan', async () => {
    await db.execute(`
      INSERT INTO daily_performance_snapshots
        (employee_id, snapshot_date, dpi_score, traffic_light, indicators_expected, indicators_filled)
      VALUES ('${BUDI}', '2026-10-20', 95.00, 'GREEN', 3, 3),
             ('${BUDI}', '2026-10-21', 64.00, 'RED', 3, 2)`);

    const res = await db.execute(`
      SELECT days_green, days_red, avg_dpi, entry_adherence
        FROM v_employee_daily_recap
       WHERE employee_id = '${BUDI}' AND period_month = '2026-10-01'`);
    expect(Number(res.rows[0].days_green)).toBe(1);
    expect(Number(res.rows[0].days_red)).toBe(1);
    expect(Number(res.rows[0].avg_dpi)).toBeCloseTo(79.5, 1);
  });

  it('menolak DPI di luar 0..120', async () => {
    await expect(db.execute(`
      INSERT INTO daily_performance_snapshots (employee_id, snapshot_date, dpi_score)
      VALUES ('${BUDI}', '2026-10-22', 150)`),
    ).rejects.toThrow(/check constraint/i);
  });
});
