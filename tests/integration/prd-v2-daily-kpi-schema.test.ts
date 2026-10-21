import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('PRD v2 — skema KPI harian', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('satu entri per indikator per hari', async () => {
    const kpi = await db.execute(`
      SELECT k.id FROM individual_kpis k LIMIT 1`);
    expect(kpi.rows.length).toBe(1);
    const kpiId = kpi.rows[0].id;

    const ind = await db.execute(`
      INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value)
      VALUES ('${kpiId}', 'Tiket selesai', 10) RETURNING id`);
    const indId = ind.rows[0].id;

    const emp = await db.execute(`SELECT employee_id FROM individual_kpis WHERE id = '${kpiId}'`);
    const employeeId = emp.rows[0].employee_id;

    await db.execute(`
      INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value)
      VALUES ('${indId}', '${employeeId}', '2026-10-21', 8)`);

    await expect(db.execute(`
      INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value)
      VALUES ('${indId}', '${employeeId}', '2026-10-21', 9)`),
    ).rejects.toThrow(/duplicate key|unique/i);
  });
});
