import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getPositionFit } from '@/lib/services/boardPositionFitService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const ANISA = 'b0000000-0000-4000-8000-000000000007';
const DIMAS = 'b0000000-0000-4000-8000-000000000008';
const CEO = 'b0000000-0000-4000-8000-000000000001';
const PERIOD = 'd0000000-0000-4000-8000-000000000001';

describe('Position Fit (Kesesuaian Posisi & RJMP)', () => {
  let client: PGlite;
  let db: Db;
  let pillarId = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
    const p = await db.execute(sql`SELECT id FROM strategic_pillars LIMIT 1`);
    pillarId = String((p.rows[0] as { id: string }).id);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  const insertKpi = async (employeeId: string, title: string, weight: number, actual: number) => {
    await db.execute(sql`
      INSERT INTO individual_kpis
        (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, actual_value, kpi_weight)
      VALUES (${PERIOD}::uuid, ${employeeId}::uuid, ${pillarId}::uuid, ${title}, 100, ${actual}, ${weight})
    `);
  };

  it('mengevaluasi seluruh pegawai aktif', async () => {
    const result = await getPositionFit(db);
    expect(result.employees.length).toBeGreaterThanOrEqual(10);
    expect(result.sampleSize).toBe(result.employees.length);
  });

  it('menandai posisi tanpa template sebagai NO_TEMPLATE, bukan gagal', async () => {
    // Semua posisi seed punya template, jadi kasus ini dibuat sebagai fixture:
    // satu posisi baru tanpa template + satu pegawai yang mendudukinya.
    const dept = await db.execute(sql`SELECT id FROM departments LIMIT 1`);
    const deptId = String((dept.rows[0] as { id: string }).id);

    const pos = await db.execute(sql`
      INSERT INTO job_positions (id, department_id, position_title, job_grade)
      VALUES ('ff000000-0000-4000-8000-000000000001'::uuid, ${deptId}::uuid,
              'Posisi Tanpa Template', 'G2')
      RETURNING id
    `);
    const posId = String((pos.rows[0] as { id: string }).id);

    await db.execute(sql`
      INSERT INTO employees (employee_code, full_name, email, department_id, position_id,
                             status, base_salary, join_date)
      VALUES ('TEST-NOTPL-1', 'Pegawai Tanpa Template', 'tanpa.template@eperformiq.co.id',
              ${deptId}::uuid, ${posId}::uuid, 'PERMANENT', 8000000, CURRENT_DATE)
    `);

    const result = await getPositionFit(db);
    const target = result.employees.find((e) => e.employeeCode === 'TEST-NOTPL-1');
    expect(target?.status).toBe('NO_TEMPLATE');
    expect(target?.templateKpiCount).toBe(0);
    expect(target?.coveragePercentage).toBe(0);
  });

  it('melaporkan KPI yang tidak cocok template secara eksplisit', async () => {
    const result = await getPositionFit(db);
    const budi = result.employees.find((e) => e.employeeId === BUDI);
    expect(budi?.templateKpiCount).toBe(3);
    expect(budi?.matchedKpiCount).toBe(0);
    expect(budi?.coveragePercentage).toBe(0);
    expect(budi?.status).toBe('NOT_COMPLIANT');
  });

  it('menghitung COMPLIANT saat seluruh KPI template cocok dan capaian >= 100', async () => {
    await insertKpi(ANISA, 'Defect Density (Bug per KLOC)', 35, 105);
    await insertKpi(ANISA, 'Ketepatan Sprint Commitment', 35, 100);
    await insertKpi(ANISA, 'Coverage Unit Test', 30, 110);

    const result = await getPositionFit(db);
    const anisa = result.employees.find((e) => e.employeeId === ANISA);
    expect(anisa?.matchedKpiCount).toBe(3);
    expect(anisa?.coveragePercentage).toBe(100);
    expect(anisa?.achievementPercentage).toBe(104.8);
    expect(anisa?.status).toBe('COMPLIANT');
  });

  it('menghitung PARTIAL saat hanya sebagian KPI template cocok', async () => {
    await insertKpi(DIMAS, 'Defect Density (Bug per KLOC)', 35, 90);
    await insertKpi(DIMAS, 'Ketepatan Sprint Commitment', 35, 95);

    const result = await getPositionFit(db);
    const dimas = result.employees.find((e) => e.employeeId === DIMAS);
    expect(dimas?.matchedKpiCount).toBe(2);
    expect(dimas?.coveragePercentage).toBe(70);
    expect(dimas?.status).toBe('PARTIAL');
  });

  it('tidak menghasilkan NaN meski posisi tanpa template', async () => {
    const result = await getPositionFit(db);
    for (const e of result.employees) {
      expect(Number.isFinite(e.coveragePercentage)).toBe(true);
      expect(Number.isFinite(e.achievementPercentage)).toBe(true);
    }
    for (const p of result.byPosition) {
      expect(Number.isFinite(p.coveragePercentage)).toBe(true);
      expect(Number.isFinite(p.achievementPercentage)).toBe(true);
    }
  });

  it('menyusun analisis jumlah posisi patuh dan tanpa template', async () => {
    // Jadikan posisi CEO patuh: seluruh pemegangnya memenuhi template.
    // Template CEO: Pertumbuhan Pendapatan vs RKAP 40, EBITDA Margin 30, Indeks Kepuasan 30.
    await insertKpi(CEO, 'Pertumbuhan Pendapatan vs RKAP', 40, 110);
    await insertKpi(CEO, 'EBITDA Margin Korporasi', 30, 105);
    await insertKpi(CEO, 'Indeks Kepuasan Stakeholder', 30, 100);

    const result = await getPositionFit(db);
    const ceoPosition = result.byPosition.find((p) => p.positionTitle.includes('Chief Executive'));
    expect(ceoPosition?.status).toBe('COMPLIANT');
    expect(ceoPosition?.compliantHolders).toBe(1);

    expect(result.analysis.compliantPositions).toBeGreaterThanOrEqual(1);
    expect(result.analysis.positionsWithoutTemplate).toBeGreaterThanOrEqual(1);
    expect(result.analysis.highlights.length).toBeGreaterThan(0);
  });
});
