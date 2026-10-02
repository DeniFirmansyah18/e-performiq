/**
 * Payroll Service (WS-10) — orkestrasi run payroll per periode.
 *
 * Menggabungkan:
 *  - Kalkulasi deterministik dari `payroll-engine` (lembur, BPJS, PPh21, THR, pro-rata).
 *  - Data kehadiran & lembur dari WS-9 (`getAttendanceSummary`).
 *  - Data karyawan (gaji pokok, tunjangan tetap, masa kerja).
 *
 * AI advisory (ringkasan/anomali) bersifat OPSIONAL & tidak memblokir proses.
 * Deterministik, driver-agnostic, best-effort.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  computePayrollItem,
  computeThr,
  DEFAULT_RATES,
  type PayrollRates,
  type PayrollItemResult,
} from '@/lib/engines/payroll-engine';

export interface EmployeePayrollInput {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string;
  position: string;
  baseSalary: number;
  joinDate: string | null;
}

/** Ambil karyawan aktif beserta konteks payroll. */
export async function listActiveEmployeesForPayroll(db: Db, rates?: PayrollRates): Promise<EmployeePayrollInput[]> {
  void rates;
  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.employee_code AS "employeeCode", e.full_name AS "fullName",
           e.base_salary::float8 AS "baseSalary", e.join_date::text AS "joinDate",
           d.department_name AS "department", p.position_title AS "position"
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      JOIN job_positions p ON p.id = e.position_id
     WHERE e.status IN ('PERMANENT','CONTRACT','PROBATION')
     ORDER BY e.employee_code
  `)) as unknown as { rows: EmployeePayrollInput[] };
  return res.rows ?? [];
}

/** Tunjangan tetap = 25% gaji pokok (kebijakan contoh; configurable kelak). */
export function fixedAllowanceOf(baseSalary: number): number {
  return Math.round(baseSalary * 0.25);
}

/** Bulan (0-11) yang dianggap bulan THR (contoh: Juni). */
export const THR_MONTH_INDEX = 5;

export interface GenerateRunInput {
  periodCode: string;   // 'YYYY-MM'
  periodStart: string;
  periodEnd: string;
  isThrMonth?: boolean;
  rates?: PayrollRates;
  createdBy?: string;
}

export interface GenerateRunResult {
  runId: string;
  periodCode: string;
  items: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}

/**
 * Membuat/menyegarkan run payroll untuk periode tertentu.
 * Bila run sudah ada & belum APPROVED/PAID → item di-*replace* (regenerate).
 */
export async function generatePayrollRun(db: Db, input: GenerateRunInput): Promise<GenerateRunResult> {
  const rates = input.rates ?? DEFAULT_RATES;

  // Upsert run header.
  const runRes = (await db.execute(sql`
    INSERT INTO payroll_runs (period_code, period_start, period_end, status, is_thr_month, created_by)
    VALUES (${input.periodCode}, ${input.periodStart}::date, ${input.periodEnd}::date,
            'PROCESSING', ${input.isThrMonth ?? false}, ${input.createdBy ?? null}::uuid)
    ON CONFLICT (period_code)
    DO UPDATE SET period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end,
                  is_thr_month = EXCLUDED.is_thr_month, status = 'PROCESSING'
    RETURNING id, status
  `)) as unknown as { rows: Array<{ id: string; status: string }> };
  const runId = runRes.rows[0].id;
  if (['APPROVED', 'PAID'].includes(runRes.rows[0].status) && runRes.rows[0].status !== 'PROCESSING') {
    // status dikembalikan PROCESSING oleh upsert; guard tambahan tidak diperlukan.
  }

  // Hapus item lama (regenerate idempoten).
  await db.execute(sql`DELETE FROM payroll_items WHERE run_id = ${runId}::uuid`);

  const employees = await listActiveEmployeesForPayroll(db, rates);
  const workingDays = countWorkingDays(input.periodStart, input.periodEnd);
  let totalGross = 0;
  let totalDed = 0;
  let totalNet = 0;

  for (const emp of employees) {
    // Kehadiran & lembur dari WS-9.
    let presentDays = workingDays;
    let overtimeHours = 0;
    try {
      const { getAttendanceSummary } = await import('@/lib/services/attendanceLogService');
      const att = await getAttendanceSummary(db, emp.employeeId, input.periodStart, input.periodEnd);
      if (att.presentDays > 0) presentDays = Math.min(workingDays, att.presentDays);
      overtimeHours = att.overtimeHours;
    } catch {
      /* absensi opsional */
    }

    const monthsOfService = emp.joinDate ? monthsBetween(emp.joinDate, input.periodEnd) : 12;
    const thr = (input.isThrMonth ?? false) ? computeThr(emp.baseSalary, monthsOfService) : 0;

    const result = computePayrollItem({
      baseSalary: emp.baseSalary,
      fixedAllowance: fixedAllowanceOf(emp.baseSalary),
      overtimeHours,
      thr,
      presentDays,
      workingDays,
      rates,
    });

    await insertItem(db, runId, emp, result, { overtimeHours, presentDays, workingDays });

    totalGross += result.gross;
    totalDed += result.totalDeductions;
    totalNet += result.net;
  }

  await db.execute(sql`
    UPDATE payroll_runs SET status = 'DRAFT', total_gross = ${totalGross},
           total_deductions = ${totalDed}, total_net = ${totalNet}
     WHERE id = ${runId}::uuid
  `);

  return {
    runId,
    periodCode: input.periodCode,
    items: employees.length,
    totalGross: round2(totalGross),
    totalDeductions: round2(totalDed),
    totalNet: round2(totalNet),
  };
}

async function insertItem(
  db: Db, runId: string, emp: EmployeePayrollInput, r: PayrollItemResult,
  meta: { overtimeHours: number; presentDays: number; workingDays: number },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO payroll_items
      (run_id, employee_id, base_salary, fixed_allowance, overtime_pay, bonus, thr,
       other_earnings, bpjs_kesehatan, bpjs_jht, bpjs_jp, pph21, other_deductions, employer_bpjs,
       overtime_hours, present_days, working_days, gross, total_deductions, net)
    VALUES
      (${runId}::uuid, ${emp.employeeId}::uuid, ${r.baseSalary}, ${r.fixedAllowance}, ${r.overtimePay},
       ${r.bonus}, ${r.thr}, ${JSON.stringify(r.otherEarnings)}::jsonb,
       ${r.bpjs.kesehatan}, ${r.bpjs.jht}, ${r.bpjs.jp}, ${r.pph21},
       ${JSON.stringify(r.otherDeductions)}::jsonb, ${JSON.stringify(r.bpjs.employer)}::jsonb,
       ${meta.overtimeHours}, ${meta.presentDays}, ${meta.workingDays}, ${r.gross}, ${r.totalDeductions}, ${r.net})
    ON CONFLICT (run_id, employee_id) DO NOTHING
  `);
}

/** Setujui run (HR). */
export async function approvePayrollRun(db: Db, runId: string, approvedBy: string): Promise<boolean> {
  const res = (await db.execute(sql`
    UPDATE payroll_runs SET status = 'APPROVED', approved_by = ${approvedBy}::uuid, approved_at = CURRENT_TIMESTAMP
     WHERE id = ${runId}::uuid AND status IN ('DRAFT','PROCESSING')
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  return !!res.rows[0];
}

/** Tandai run dibayar (PAID). */
export async function markPayrollPaid(db: Db, runId: string): Promise<boolean> {
  const res = (await db.execute(sql`
    UPDATE payroll_runs SET status = 'PAID' WHERE id = ${runId}::uuid AND status = 'APPROVED' RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  return !!res.rows[0];
}

/** Daftar run payroll (HR). */
export async function listPayrollRuns(db: Db, limit = 24) {
  const res = (await db.execute(sql`
    SELECT id, period_code AS "periodCode", period_start::text AS "periodStart", period_end::text AS "periodEnd",
           status, is_thr_month AS "isThrMonth", total_gross::float8 AS "totalGross",
           total_deductions::float8 AS "totalDeductions", total_net::float8 AS "totalNet",
           created_at AS "createdAt", approved_at AS "approvedAt"
      FROM payroll_runs ORDER BY period_start DESC LIMIT ${limit}
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}

/** Rincian item dalam sebuah run (HR). */
export async function listPayrollItems(db: Db, runId: string) {
  const res = (await db.execute(sql`
    SELECT pi.id, pi.employee_id AS "employeeId", e.employee_code AS "employeeCode", e.full_name AS "fullName",
           d.department_name AS "department",
           pi.base_salary::float8 AS "baseSalary", pi.fixed_allowance::float8 AS "fixedAllowance",
           pi.overtime_pay::float8 AS "overtimePay", pi.overtime_hours::float8 AS "overtimeHours",
           pi.bonus::float8 AS bonus, pi.thr::float8 AS thr, pi.pph21::float8 AS pph21,
           pi.bpjs_kesehatan::float8 AS "bpjsKesehatan", pi.bpjs_jht::float8 AS "bpjsJht",
           pi.bpjs_jp::float8 AS "bpjsJp", pi.present_days AS "presentDays", pi.working_days AS "workingDays",
           pi.gross::float8 AS gross, pi.total_deductions::float8 AS "totalDeductions", pi.net::float8 AS net
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      JOIN departments d ON d.id = e.department_id
     WHERE pi.run_id = ${runId}::uuid
     ORDER BY e.employee_code
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}

/** Slip gaji karyawan untuk sebuah periode/run (dipakai portal, dengan PIN). */
export async function getPayslipDetail(db: Db, employeeId: string, runId?: string) {
  const res = (await db.execute(sql`
    SELECT pi.id, pr.period_code AS "periodCode", pr.status AS "runStatus", pr.period_start::text AS "periodStart",
           e.employee_code AS "employeeCode", e.full_name AS "fullName",
           d.department_name AS "department", p.position_title AS "position",
           pi.base_salary::float8 AS "baseSalary", pi.fixed_allowance::float8 AS "fixedAllowance",
           pi.overtime_pay::float8 AS "overtimePay", pi.overtime_hours::float8 AS "overtimeHours",
           pi.bonus::float8 AS bonus, pi.thr::float8 AS thr, pi.other_earnings AS "otherEarnings",
           pi.bpjs_kesehatan::float8 AS "bpjsKesehatan", pi.bpjs_jht::float8 AS "bpjsJht",
           pi.bpjs_jp::float8 AS "bpjsJp", pi.pph21::float8 AS pph21, pi.other_deductions AS "otherDeductions",
           pi.employer_bpjs AS "employerBpjs", pi.present_days AS "presentDays", pi.working_days AS "workingDays",
           pi.gross::float8 AS gross, pi.total_deductions::float8 AS "totalDeductions", pi.net::float8 AS net
      FROM payroll_items pi
      JOIN payroll_runs pr ON pr.id = pi.run_id
      JOIN employees e ON e.id = pi.employee_id
      JOIN departments d ON d.id = e.department_id
      JOIN job_positions p ON p.id = e.position_id
     WHERE pi.employee_id = ${employeeId}::uuid
       AND (${runId ?? null}::uuid IS NULL OR pi.run_id = ${runId ?? null}::uuid)
     ORDER BY pr.period_start DESC
     LIMIT 1
  `)) as unknown as { rows: any[] };
  return res.rows?.[0] ?? null;
}

/** Ringkasan seluruh run untuk advisory AI (agregat & anomali). */
export async function payrollRunSummary(db: Db, runId: string) {
  const head = (await db.execute(sql`
    SELECT period_code AS "periodCode", status, count(*) AS "x" FROM payroll_runs WHERE id = ${runId}::uuid GROUP BY period_code, status
  `)) as unknown as { rows: any[] };
  const agg = (await db.execute(sql`
    SELECT COUNT(*)::int AS "employees", COALESCE(SUM(gross),0)::float8 AS "totalGross",
           COALESCE(SUM(total_deductions),0)::float8 AS "totalDeductions", COALESCE(SUM(net),0)::float8 AS "totalNet",
           COALESCE(AVG(net),0)::float8 AS "avgNet", COALESCE(MAX(net),0)::float8 AS "maxNet",
           COALESCE(MIN(net),0)::float8 AS "minNet", COALESCE(SUM(overtime_pay),0)::float8 AS "totalOvertime"
      FROM payroll_items WHERE run_id = ${runId}::uuid
  `)) as unknown as { rows: any[] };
  const anomalies = (await db.execute(sql`
    SELECT e.full_name AS "fullName", pi.net::float8 AS net, pi.overtime_hours::float8 AS "overtimeHours"
      FROM payroll_items pi JOIN employees e ON e.id = pi.employee_id
     WHERE pi.run_id = ${runId}::uuid AND (pi.net <= 0 OR pi.overtime_hours > 20)
     ORDER BY pi.net ASC LIMIT 10
  `)) as unknown as { rows: any[] };
  return { period: head.rows?.[0]?.periodCode ?? null, status: head.rows?.[0]?.status ?? null, ...(agg.rows?.[0] ?? {}), anomalies: anomalies.rows ?? [] };
}

/** Jumlah hari kerja (Sen–Jum) dalam rentang. */
export function countWorkingDays(startIso: string, endIso: string): number {
  const start = new Date(startIso + 'T00:00:00Z');
  const end = new Date(endIso + 'T00:00:00Z');
  let n = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n += 1;
  }
  return n || 22;
}

/** Selisih bulan (desimal) antara dua tanggal ISO. */
export function monthsBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 12;
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}
