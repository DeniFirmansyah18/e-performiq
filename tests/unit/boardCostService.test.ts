import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getBoardCostOverview } from '@/lib/services/boardCostService';

describe('Board Cost Overview (Payroll, BPJS, Lembur, Operasional)', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('memakai run payroll terbaru sebagai dasar rincian', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.payroll.latest?.periodCode).toBe('2026-09');
    expect(result.payroll.latest?.totalNet).toBe(135710000);
    expect(result.sampleSize).toBe(4);
    expect(result.employees).toHaveLength(4);
  });

  it('menghitung jumlah item per run, bukan mengisi nol', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.payroll.runs).toHaveLength(2);
    for (const run of result.payroll.runs) {
      expect(run.employeeCount).toBe(4);
    }
  });

  it('menghitung biaya per pegawai dan konsentrasi top-decil', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.analysis.costPerEmployee).toBeCloseTo(33927500, 0);
    expect(Number.isFinite(result.analysis.topDecileCostShare)).toBe(true);
    expect(result.analysis.topDecileCostShare).toBeGreaterThan(0);
    expect(result.analysis.topDecileCostShare).toBeLessThanOrEqual(100);
  });

  it('menghitung pertumbuhan payroll dan null pada titik pertama', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.analysis.payrollGrowthPercentage).not.toBeNull();

    const trend = result.payroll.trend;
    expect(trend).toHaveLength(2);
    // Trend diurutkan lama -> baru; titik pertama tidak punya pembanding.
    expect(trend[0].deltaPercentage).toBeNull();
    expect(trend[1].deltaPercentage).not.toBeNull();
  });

  it('mem-mask nomor BPJS dan tidak membocorkan nomor utuh', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.bpjs.employees.length).toBeGreaterThanOrEqual(3);
    const withNumber = result.bpjs.employees.filter((e) => e.bpjsKesNumberMasked);
    expect(withNumber.length).toBeGreaterThanOrEqual(2);

    for (const row of result.bpjs.employees) {
      expect(row.bpjsKesNumberMasked ?? '').not.toMatch(/^\d{16}$/);
      expect(row.bpjsTkNumberMasked ?? '').not.toMatch(/^\d{16}$/);
    }
    expect(JSON.stringify(result)).not.toMatch(/\d{16}/);
  });

  it('meringkas lembur dan pengajuan yang menunggu persetujuan', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.overtime.totalHours).toBe(2);
    expect(result.overtime.totalPay).toBe(750000);
    expect(result.overtime.pendingApprovals).toBe(2);
    expect(result.overtime.byDepartment.length).toBeGreaterThan(0);
  });

  it('meringkas biaya operasional per kategori dan status', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.operational.totalAmount).toBe(2550000);
    const travel = result.operational.byCategory.find((c) => c.category === 'TRAVEL');
    expect(travel?.amount).toBe(1250000);
    expect(travel?.count).toBe(1);
  });

  it('menghormati paginasi rincian pegawai', async () => {
    const page1 = await getBoardCostOverview(db, { page: 1, pageSize: 2 });
    expect(page1.employees).toHaveLength(2);
    expect(page1.employeesPagination.total).toBe(4);

    const page2 = await getBoardCostOverview(db, { page: 2, pageSize: 2 });
    expect(page2.employees).toHaveLength(2);
    const ids1 = page1.employees.map((e) => e.employeeId);
    const ids2 = page2.employees.map((e) => e.employeeId);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it('aman saat belum ada run payroll sama sekali', async () => {
    await client.exec('DELETE FROM payroll_items; DELETE FROM payroll_runs;');
    const result = await getBoardCostOverview(db);

    expect(result.payroll.latest).toBeNull();
    expect(result.payroll.runs).toEqual([]);
    expect(result.employees).toEqual([]);
    expect(result.sampleSize).toBe(0);
    expect(result.analysis.costPerEmployee).toBe(0);
    expect(result.analysis.topDecileCostShare).toBe(0);
    expect(result.analysis.payrollGrowthPercentage).toBeNull();
    expect(result.analysis.highlights.length).toBeGreaterThan(0);
  });
});
