import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  generatePayrollRun,
  approvePayrollRun,
  markPayrollPaid,
  listPayrollRuns,
  listPayrollItems,
  getPayslipDetail,
  payrollRunSummary,
  countWorkingDays,
  fixedAllowanceOf,
} from '@/lib/services/payrollService';

describe('WS-10 payroll service (integrasi DB)', () => {
  let client: PGlite;
  let db: any;
  let runId: string;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('countWorkingDays menghitung Senin–Jumat', () => {
    // 2026-09-01 (Sel) s/d 2026-09-07 (Sen) → 5 hari kerja
    const n = countWorkingDays('2026-09-01', '2026-09-07');
    expect(n).toBe(5);
  });

  it('fixedAllowanceOf = 25% gaji pokok', () => {
    expect(fixedAllowanceOf(10_000_000)).toBe(2_500_000);
  });

  it('generatePayrollRun membuat run + item untuk semua karyawan aktif', async () => {
    const res = await generatePayrollRun(db, {
      periodCode: '2026-09', periodStart: '2026-09-01', periodEnd: '2026-09-30',
    });
    runId = res.runId;
    expect(res.items).toBeGreaterThanOrEqual(1);
    expect(res.totalGross).toBeGreaterThan(0);
    expect(res.totalNet).toBeLessThanOrEqual(res.totalGross);

    const runs = await listPayrollRuns(db);
    expect(runs.some((r) => r.periodCode === '2026-09')).toBe(true);
  });

  it('item payroll punya komponen lengkap & net = gross − potongan', async () => {
    const items = await listPayrollItems(db, runId);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const it = items[0];
    expect(it.baseSalary).toBeGreaterThan(0);
    expect(it).toHaveProperty('bpjsKesehatan');
    expect(it).toHaveProperty('pph21');
    // net = gross - totalDeductions (toleransi pembulatan)
    expect(Math.abs(it.net - (it.gross - it.totalDeductions))).toBeLessThanOrEqual(1);
  });

  it('idempoten: generate ulang tidak menduplikasi item', async () => {
    const first = await listPayrollItems(db, runId);
    await generatePayrollRun(db, { periodCode: '2026-09', periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    const again = await listPayrollItems(db, runId);
    expect(again.length).toBe(first.length);
  });

  it('THR month menghasilkan komponen thr > 0', async () => {
    const res = await generatePayrollRun(db, {
      periodCode: '2026-06', periodStart: '2026-06-01', periodEnd: '2026-06-30', isThrMonth: true,
    });
    const items = await listPayrollItems(db, res.runId);
    expect(items.some((i) => i.thr > 0)).toBe(true);
  });

  it('approve → PAID alur status', async () => {
    const userRes = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'HR_MANAGER' LIMIT 1`,
    );
    const hr = userRes.rows[0].id;
    expect(await approvePayrollRun(db, runId, hr)).toBe(true);
    expect(await markPayrollPaid(db, runId)).toBe(true);
    const runs = await listPayrollRuns(db);
    expect(runs.find((r) => r.id === runId)!.status).toBe('PAID');
  });

  it('getPayslipDetail mengembalikan rincian slip karyawan', async () => {
    const emp = await client.query<{ id: string }>(`SELECT id FROM employees LIMIT 1`);
    const slip = await getPayslipDetail(db, emp.rows[0].id);
    expect(slip).not.toBeNull();
    expect(slip).toHaveProperty('net');
    expect(slip).toHaveProperty('periodCode');
  });

  it('payrollRunSummary mengagregasi total & anomali', async () => {
    const s = await payrollRunSummary(db, runId);
    expect(s.employees).toBeGreaterThanOrEqual(1);
    expect(s.totalGross).toBeGreaterThan(0);
    expect(Array.isArray(s.anomalies)).toBe(true);
  });
});
