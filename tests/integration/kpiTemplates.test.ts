import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { seedStarterKpis } from '@/lib/services/kpiService';
import { insertIndividualKpi } from '@/lib/repositories/kpiRepository';

const CEO_POSITION = 'a0000000-0000-4000-8000-000000000201';
const SWE_POSITION = 'a0000000-0000-4000-8000-000000000204';
const ACTIVE_PERIOD = 'd0000000-0000-4000-8000-000000000001';

describe('Template KPI per jabatan (position_kpi_templates)', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  /** Karyawan sintetis dengan position_id tertentu pada departemen Engineering. */
  async function makeEmployee(positionId: string, email: string): Promise<string> {
    const res = await client.query<{ id: string }>(
      `INSERT INTO employees (employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES ($1, $2, $3, 'a0000000-0000-4000-8000-000000000101', $4, 'PERMANENT'::employee_status_enum, 10000000, CURRENT_DATE)
       RETURNING id`,
      [`EMP-TPL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, 'Karyawan Template', email, positionId]);
    return res.rows[0].id;
  }

  it('seed menyediakan template KPI untuk beberapa jabatan dengan total bobot 100%', async () => {
    const res = await client.query<{ position_id: string; total: string }>(
      `SELECT position_id, SUM(kpi_weight)::text AS total
         FROM position_kpi_templates GROUP BY position_id`);
    expect(res.rows.length).toBeGreaterThanOrEqual(7);
    for (const r of res.rows) {
      expect(Number(r.total)).toBe(100);
    }
  });

  it('seedStarterKpis memakai template jabatan CEO (source=template)', async () => {
    const empId = await makeEmployee(CEO_POSITION, `ceo.tpl.${Date.now()}@example.com`);
    const res = await seedStarterKpis(db, empId, ACTIVE_PERIOD);
    expect(res.seeded).toBe(true);
    expect(res.source).toBe('template');
    expect(res.kpis.length).toBe(3);
    const total = res.kpis.reduce((s: number, k: any) => s + Number(k.kpiWeight), 0);
    expect(total).toBe(100);
    expect(res.kpis.map((k: any) => k.kpiTitle)).toContain('Pertumbuhan Pendapatan vs RKAP');
  });

  it('seedStarterKpis memakai template jabatan Software Engineer (source=template)', async () => {
    const empId = await makeEmployee(SWE_POSITION, `swe.tpl.${Date.now()}@example.com`);
    const res = await seedStarterKpis(db, empId, ACTIVE_PERIOD);
    expect(res.seeded).toBe(true);
    expect(res.source).toBe('template');
    expect(res.kpis.length).toBe(3);
    expect(res.kpis.map((k: any) => k.kpiTitle)).toContain('Coverage Unit Test');
  });

  it('fallback ke KPI generik (4 sasaran, 100%) bila jabatan tanpa template', async () => {
    // Position tanpa template — insert langsung tanpa baris position_kpi_templates.
    const posRes = await client.query<{ id: string }>(
      `INSERT INTO job_positions (department_id, position_title, job_grade)
       VALUES ('a0000000-0000-4000-8000-000000000101', $1, '5') RETURNING id`,
      [`Staf Tanpa Template ${Date.now()}`]);
    const empId = await makeEmployee(posRes.rows[0].id, `generic.tpl.${Date.now()}@example.com`);
    const res = await seedStarterKpis(db, empId, ACTIVE_PERIOD);
    expect(res.seeded).toBe(true);
    expect(res.source).toBe('generic');
    expect(res.kpis.length).toBe(4);
    const total = res.kpis.reduce((s: number, k: any) => s + Number(k.kpiWeight), 0);
    expect(total).toBe(100);
  });

  it('idempoten: tidak menimpa KPI yang sudah ada (source=none)', async () => {
    const empId = await makeEmployee(CEO_POSITION, `idem.tpl.${Date.now()}@example.com`);
    const first = await seedStarterKpis(db, empId, ACTIVE_PERIOD);
    expect(first.source).toBe('template');
    const second = await seedStarterKpis(db, empId, ACTIVE_PERIOD);
    expect(second.seeded).toBe(false);
    expect(second.source).toBe('none');
    const n = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM individual_kpis WHERE employee_id = $1::uuid`, [empId]);
    expect(Number(n.rows[0].n)).toBe(first.kpis.length);
  });

  it('menghormati KPI yang sudah diisi manual (tidak menambah)', async () => {
    const empId = await makeEmployee(SWE_POSITION, `manual.tpl.${Date.now()}@example.com`);
    const pillar = await client.query<{ id: string }>(`SELECT id FROM strategic_pillars LIMIT 1`);
    await insertIndividualKpi(db, {
      periodId: ACTIVE_PERIOD, employeeId: empId, strategicPillarId: pillar.rows[0].id,
      kpiTitle: 'KPI Manual Karyawan', targetValue: 100, unitOfMeasure: '%', kpiWeight: 100, status: 'SUBMITTED',
    });
    const res = await seedStarterKpis(db, empId, ACTIVE_PERIOD);
    expect(res.seeded).toBe(false);
    expect(res.source).toBe('none');
    expect(res.kpis.length).toBe(1);
    expect(res.kpis[0].kpiTitle).toBe('KPI Manual Karyawan');
  });
});
