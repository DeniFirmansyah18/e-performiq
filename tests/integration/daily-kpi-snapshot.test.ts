import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { saveEntry, verifyEntry } from '@/lib/services/dailyKpiService';

describe('snapshot ditulis saat entri dikirim/diverifikasi', () => {
  let client: PGlite;
  let db: any;
  let employeeId = '';
  let indicatorId = '';
  let entryId = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    const stamp = Date.now();
    const emp = (await db.execute(`
      INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
      VALUES (gen_random_uuid(), 'SNP-${stamp}', 'Snapshot Uji', 'snp.${stamp}@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
              'PERMANENT', 8000000, CURRENT_DATE)
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    employeeId = emp.rows[0].id;

    const pillar = (await db.execute(`SELECT id FROM strategic_pillars LIMIT 1`)) as unknown as {
      rows: Array<{ id: string }>;
    };
    const period = (await db.execute(`
      INSERT INTO appraisal_periods (period_code, start_date, end_date)
      VALUES ('SNP-${stamp}', '2026-10-01', '2026-10-31') RETURNING id`)) as unknown as {
      rows: Array<{ id: string }>;
    };
    const kpi = (await db.execute(`
      INSERT INTO individual_kpis
        (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, unit_of_measure, kpi_weight)
      VALUES ('${period.rows[0].id}', '${employeeId}', '${pillar.rows[0].id}', 'Snap ${stamp}', 10, 'tiket', 100)
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    const ind = (await db.execute(`
      INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value, indicator_weight)
      VALUES ('${kpi.rows[0].id}', 'Tiket selesai', 10, 100) RETURNING id`)) as unknown as {
      rows: Array<{ id: string }>;
    };
    indicatorId = ind.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  it('draf tidak membuat snapshot', async () => {
    await saveEntry(db, {
      employeeId, indicatorId, entryDate: '2026-10-10', actualValue: 5, submit: false,
    });
    const res = (await db.execute(`
      SELECT count(*)::int AS n FROM daily_performance_snapshots
       WHERE employee_id = '${employeeId}' AND snapshot_date = '2026-10-10'`)) as unknown as {
      rows: Array<{ n: number }>;
    };
    expect(res.rows[0].n).toBe(0);
  });

  it('pengiriman entri menulis snapshot hari itu', async () => {
    const entry = await saveEntry(db, {
      employeeId, indicatorId, entryDate: '2026-10-10', actualValue: 10, submit: true,
    });
    entryId = entry.id;

    const res = (await db.execute(`
      SELECT dpi_score::float8 AS score, traffic_light AS light, indicators_filled AS filled
        FROM daily_performance_snapshots
       WHERE employee_id = '${employeeId}' AND snapshot_date = '2026-10-10'`)) as unknown as {
      rows: Array<{ score: number; light: string; filled: number }>;
    };
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].score).toBeCloseTo(100, 1);
    expect(res.rows[0].filled).toBe(1);
  });

  it('verifikasi menulis ulang snapshot tanpa menggandakan baris', async () => {
    await verifyEntry(db, {
      entryId, verifierId: 'e0000000-0000-4000-8000-000000000002', decision: 'VERIFIED',
    });
    const res = (await db.execute(`
      SELECT count(*)::int AS n FROM daily_performance_snapshots
       WHERE employee_id = '${employeeId}' AND snapshot_date = '2026-10-10'`)) as unknown as {
      rows: Array<{ n: number }>;
    };
    expect(res.rows[0].n).toBe(1);
  });
});
