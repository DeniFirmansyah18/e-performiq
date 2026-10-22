import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { generatePayrollRun } from '@/lib/services/payrollService';
import { computeOvertimePay } from '@/lib/engines/payroll-engine';

const APPROVER = 'e0000000-0000-4000-8000-000000000002';
const BASE_SALARY = 10_000_000;

describe('payroll memakai lembur yang disetujui', () => {
  let client: PGlite;
  let db: any;
  let employeeId = '';
  let runId = '';

  const addRequest = async (
    workDate: string, plannedHours: number, status: 'SUBMITTED' | 'APPROVED',
  ) => {
    await db.execute(`
      INSERT INTO overtime_requests (employee_id, work_date, planned_hours, reason, status, approved_by)
      VALUES ('${employeeId}', '${workDate}', ${plannedHours}, 'penyelesaian laporan', '${status}',
              ${status === 'APPROVED' ? `'${APPROVER}'` : 'NULL'}::uuid)`);
  };

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    const stamp = Date.now();
    const emp = (await db.execute(`
      INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
      VALUES (gen_random_uuid(), 'PAYOT-${stamp}', 'Payroll Lembur Uji', 'payot.${stamp}@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
              'PERMANENT', ${BASE_SALARY}, '2020-01-01')
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    employeeId = emp.rows[0].id;

    // Periode 2026-10: 2026-10-05 Senin (kerja), 2026-10-04 Minggu (libur).
    await db.execute(`
      INSERT INTO overtime_requests (employee_id, work_date, planned_hours, reason, status, approved_by)
      VALUES ('${employeeId}', '2026-10-05', 3, 'penyelesaian laporan', 'APPROVED', '${APPROVER}'::uuid)`);
    await db.execute(`
      INSERT INTO attendance_logs (employee_id, work_date, check_in_at, total_overtime_hours)
      VALUES ('${employeeId}', '2026-10-05', '2026-10-05T08:00:00+07:00', 2)`);

    await db.execute(`
      INSERT INTO overtime_requests (employee_id, work_date, planned_hours, reason, status, approved_by)
      VALUES ('${employeeId}', '2026-10-04', 8, 'persiapan audit', 'APPROVED', '${APPROVER}'::uuid)`);

    // Pengajuan yang TIDAK disetujui — harus diabaikan payroll.
    await db.execute(`
      INSERT INTO overtime_requests (employee_id, work_date, planned_hours, reason, status)
      VALUES ('${employeeId}', '2026-10-06', 2, 'belum disetujui', 'SUBMITTED')`);
    await db.execute(`
      INSERT INTO attendance_logs (employee_id, work_date, check_in_at, total_overtime_hours)
      VALUES ('${employeeId}', '2026-10-06', '2026-10-06T08:00:00+07:00', 2)`);
  });
  afterAll(async () => { await client.close(); });

  it('generate payroll memakai jam lembur yang disetujui saja', async () => {
    const run = await generatePayrollRun(db, {
      periodCode: 'PAYOT-TEST-1',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    });
    runId = run.runId;

    const item = (await db.execute(`
      SELECT overtime_hours::float8 AS hours, overtime_pay::float8 AS pay
        FROM payroll_items WHERE run_id = '${runId}' AND employee_id = '${employeeId}'`)) as unknown as {
      rows: Array<{ hours: number; pay: number }>;
    };

    // 2 jam hari kerja (min(3 disetujui, 2 aktual)) + 8 jam hari libur.
    expect(item.rows[0].hours).toBeCloseTo(10, 2);

    const expectedPay =
      computeOvertimePay(BASE_SALARY, 2, 'WORKDAY') + computeOvertimePay(BASE_SALARY, 8, 'REST_DAY');
    expect(item.rows[0].pay).toBeCloseTo(expectedPay, 2);
  });

  it('lembur yang belum disetujui tidak menambah upah lembur', async () => {
    const withoutUnapproved = computeOvertimePay(BASE_SALARY, 2, 'WORKDAY')
      + computeOvertimePay(BASE_SALARY, 8, 'REST_DAY');

    const item = (await db.execute(`
      SELECT overtime_pay::float8 AS pay FROM payroll_items
       WHERE run_id = '${runId}' AND employee_id = '${employeeId}'`)) as unknown as {
      rows: Array<{ pay: number }>;
    };
    // Bila 2026-10-06 (2 jam, SUBMITTED) ikut dibayar, angkanya akan lebih besar.
    expect(item.rows[0].pay).toBeCloseTo(withoutUnapproved, 2);
  });

  it('regenerate idempoten: menjalankan ulang menghasilkan angka sama', async () => {
    const before = (await db.execute(`
      SELECT overtime_pay::float8 AS pay, net::float8 AS net FROM payroll_items
       WHERE run_id = '${runId}' AND employee_id = '${employeeId}'`)) as unknown as {
      rows: Array<{ pay: number; net: number }>;
    };

    await generatePayrollRun(db, {
      periodCode: 'PAYOT-TEST-1',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    });

    const after = (await db.execute(`
      SELECT overtime_pay::float8 AS pay, net::float8 AS net FROM payroll_items
       WHERE run_id = '${runId}' AND employee_id = '${employeeId}'`)) as unknown as {
      rows: Array<{ pay: number; net: number }>;
    };

    expect(after.rows[0].pay).toBeCloseTo(before.rows[0].pay, 2);
    expect(after.rows[0].net).toBeCloseTo(before.rows[0].net, 2);
  });
});
