import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  computeSnapshot, storeSnapshot, getRecap, rollupPeriod, listTeamStatus,
} from '@/lib/services/dailyPerformanceService';

const MANAGER = 'b0000000-0000-4000-8000-000000000002';

describe('dailyPerformanceService', () => {
  let client: PGlite;
  let db: any;
  let employeeId = '';
  let kpiId = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    const stamp = Date.now();
    const emp = (await db.execute(`
      INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date, manager_id)
      VALUES (gen_random_uuid(), 'DPI-${stamp}', 'DPI Uji', 'dpi.${stamp}@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
              'PERMANENT', 8000000, CURRENT_DATE, '${MANAGER}'::uuid)
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    employeeId = emp.rows[0].id;

    const pillar = (await db.execute(`SELECT id FROM strategic_pillars LIMIT 1`)) as unknown as {
      rows: Array<{ id: string }>;
    };
    const period = (await db.execute(`
      INSERT INTO appraisal_periods (period_code, start_date, end_date)
      VALUES ('DPI-${stamp}', '2026-10-01', '2026-10-31') RETURNING id`)) as unknown as {
      rows: Array<{ id: string }>;
    };

    const kpi = (await db.execute(`
      INSERT INTO individual_kpis
        (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, unit_of_measure, kpi_weight)
      VALUES ('${period.rows[0].id}', '${employeeId}', '${pillar.rows[0].id}', 'Layanan ${stamp}', 10, 'tiket', 100)
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    kpiId = kpi.rows[0].id;

    await db.execute(`
      INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value, indicator_weight, aggregation)
      VALUES ('${kpiId}', 'Tiket selesai', 10, 60, 'SUM'),
             ('${kpiId}', 'Waktu respons (jam)', 2, 40, 'AVG')`);
  });
  afterAll(async () => { await client.close(); });

  it('tanpa entri → NO_DATA dan skor null', async () => {
    const snap = await computeSnapshot(db, employeeId, '2026-10-01');
    expect(snap.score).toBeNull();
    expect(snap.trafficLight).toBe('NO_DATA');
    expect(snap.expected).toBe(2);
    expect(snap.filled).toBe(0);
  });

  it('entri terkirim + hadir menghasilkan DPI 100 dan GREEN', async () => {
    await db.execute(`
      INSERT INTO attendance_logs (employee_id, work_date, check_in_at)
      VALUES ('${employeeId}', '2026-10-02', '2026-10-02T08:00:00+07:00')`);

    const inds = (await db.execute(`
      SELECT id, indicator_name FROM kpi_indicators WHERE kpi_id = '${kpiId}'`)) as unknown as {
      rows: Array<{ id: string; indicator_name: string }>;
    };
    const tiket = inds.rows.find((r) => r.indicator_name === 'Tiket selesai')!;
    const respons = inds.rows.find((r) => r.indicator_name === 'Waktu respons (jam)')!;

    await db.execute(`
      INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value, status)
      VALUES ('${tiket.id}', '${employeeId}', '2026-10-02', 10, 'SUBMITTED'),
             ('${respons.id}', '${employeeId}', '2026-10-02', 2, 'SUBMITTED')`);

    const snap = await computeSnapshot(db, employeeId, '2026-10-02');
    expect(snap.score).toBeCloseTo(100, 1);
    expect(snap.trafficLight).toBe('GREEN');
    expect(snap.filled).toBe(2);
  });

  it('hari kerja lampau tanpa absensi & tanpa cuti diturunkan satu tingkat', async () => {
    const inds = (await db.execute(`
      SELECT id FROM kpi_indicators WHERE kpi_id = '${kpiId}'`)) as unknown as { rows: Array<{ id: string }> };
    for (const ind of inds.rows) {
      await db.execute(`
        INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value, status)
        VALUES ('${ind.id}', '${employeeId}', '2026-10-03', 10, 'SUBMITTED')`);
    }

    const snap = await computeSnapshot(db, employeeId, '2026-10-03');
    expect(snap.trafficLight).toBe('YELLOW');
    expect(snap.demotionReason).toBe('ABSENT_WITHOUT_NOTICE');
  });

  it('DRAFT tidak dihitung dalam DPI', async () => {
    const snap = await computeSnapshot(db, employeeId, '2026-10-04');
    expect(snap.filled).toBe(0);
    expect(snap.score).toBeNull();
  });

  it('snapshot tersimpan idempoten', async () => {
    const a = await storeSnapshot(db, employeeId, '2026-10-02');
    const b = await storeSnapshot(db, employeeId, '2026-10-02');
    expect(a.score).toBeCloseTo(b.score!, 4);

    const count = (await db.execute(`
      SELECT count(*)::int AS n FROM daily_performance_snapshots
       WHERE employee_id = '${employeeId}' AND snapshot_date = '2026-10-02'`)) as unknown as {
      rows: Array<{ n: number }>;
    };
    expect(count.rows[0].n).toBe(1);
  });

  it('rollup periode menimbang rasio indikator terhadap target KPI', async () => {
    // Karyawan & KPI terpisah agar entri dari kasus lain tidak ikut ter-rollup.
    const stamp = Date.now();
    const emp = (await db.execute(`
      INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
      VALUES (gen_random_uuid(), 'ROLL-${stamp}', 'Rollup Uji', 'roll.${stamp}@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
              'PERMANENT', 8000000, CURRENT_DATE)
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    const rollEmp = emp.rows[0].id;

    const pillar = (await db.execute(`SELECT id FROM strategic_pillars LIMIT 1`)) as unknown as {
      rows: Array<{ id: string }>;
    };
    const period = (await db.execute(`
      INSERT INTO appraisal_periods (period_code, start_date, end_date)
      VALUES ('ROLL-${stamp}', '2026-10-01', '2026-10-31') RETURNING id`)) as unknown as {
      rows: Array<{ id: string }>;
    };
    const kpi = (await db.execute(`
      INSERT INTO individual_kpis
        (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, unit_of_measure, kpi_weight)
      VALUES ('${period.rows[0].id}', '${rollEmp}', '${pillar.rows[0].id}', 'Rollup ${stamp}', 10, 'tiket', 100)
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };

    const inds = (await db.execute(`
      INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value, indicator_weight, aggregation)
      VALUES ('${kpi.rows[0].id}', 'Tiket selesai', 10, 60, 'SUM'),
             ('${kpi.rows[0].id}', 'Waktu respons (jam)', 2, 40, 'AVG')
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };

    for (const ind of inds.rows) {
      await db.execute(`
        INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value, status)
        VALUES ('${ind.id}', '${rollEmp}', '2026-10-02', 10, 'SUBMITTED')`);
    }
    // Entri DRAFT tidak boleh ikut ter-rollup.
    await db.execute(`
      INSERT INTO kpi_daily_entries (indicator_id, employee_id, entry_date, actual_value, status)
      VALUES ('${inds.rows[0].id}', '${rollEmp}', '2026-10-05', 99, 'DRAFT')`);

    const res = await rollupPeriod(db, rollEmp, period.rows[0].id);
    expect(res.updated).toBe(1);

    const saved = (await db.execute(
      `SELECT actual_value::float8 AS v FROM individual_kpis WHERE id = '${kpi.rows[0].id}'`,
    )) as unknown as { rows: Array<{ v: number }> };
    // Tiket: 10/10 = 1.0 (60); Respons: 10/2 = 5.0 (40) → 2.6 → target 10 → 26.
    expect(saved.rows[0].v).toBeCloseTo(26, 2);

    // Idempoten: dijalankan ulang menghasilkan angka yang sama.
    await rollupPeriod(db, rollEmp, period.rows[0].id);
    const again = (await db.execute(
      `SELECT actual_value::float8 AS v FROM individual_kpis WHERE id = '${kpi.rows[0].id}'`,
    )) as unknown as { rows: Array<{ v: number }> };
    expect(again.rows[0].v).toBeCloseTo(26, 2);
  });

  it('rekap bulanan memakai view', async () => {
    const recap = await getRecap(db, employeeId, 'monthly', '2026-10-15');
    expect(recap.periodMonth).toBe('2026-10-01');
    expect(recap.daysGreen).toBeGreaterThanOrEqual(1);
  });

  it('rekap harian mengembalikan snapshot hari itu', async () => {
    const recap = await getRecap(db, employeeId, 'daily', '2026-10-02');
    expect(recap.avgDpi).toBeCloseTo(100, 1);
  });

  it('status tim memuat bawahan beserta warnanya', async () => {
    await storeSnapshot(db, employeeId, '2026-10-03');
    const rows = await listTeamStatus(db, MANAGER, '2026-10-03');
    expect(rows.some((r) => r.employeeId === employeeId && r.trafficLight === 'YELLOW')).toBe(true);
  });
});
