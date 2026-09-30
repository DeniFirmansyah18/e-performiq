import { getDb } from '@/lib/db/client';
import type { ExpenseClaim } from '@/types';

export interface WorkforceCostInput {
  totalPayrollIDR: number;
  totalClaimsIDR: number;
  totalOutputValueIDR: number;
}

export interface WorkforceCostResult {
  totalTCOW: number;
  tcowRatio: number;
  roiMultiplier: number;
}

/**
 * Menghitung Total Cost of Workforce (TCOW) vs Nilai Output Bisnis (ISO 30414 Clause 4.6)
 */
export function calculateCostOfWorkforce(input: WorkforceCostInput): WorkforceCostResult {
  const { totalPayrollIDR, totalClaimsIDR, totalOutputValueIDR } = input;
  const totalTCOW = totalPayrollIDR + totalClaimsIDR;
  const tcowRatio = totalOutputValueIDR > 0 ? totalTCOW / totalOutputValueIDR : 0;
  const roiMultiplier = totalTCOW > 0 ? totalOutputValueIDR / totalTCOW : 0;

  return {
    totalTCOW,
    tcowRatio,
    roiMultiplier,
  };
}

/**
 * Mengambil rincian slip gaji digital dengan otentikasi PIN 6 digit
 */
export async function getVerifiedPayslip(payload: {
  employeeId: string;
  pin: string;
}) {
  // Verifikasi PIN demo baku (6 digit '123456')
  if (payload.pin !== '123456') {
    throw new Error('PIN keamanan tidak valid.');
  }

  const db = await getDb();
  const res = await db.query<any>(
    `SELECT e.id, e.employee_code, e.full_name, e.base_salary, d.department_name, j.position_title
     FROM employees e
     JOIN departments d ON d.id = e.department_id
     JOIN job_positions j ON j.id = e.position_id
     WHERE e.id = $1;`,
    [payload.employeeId]
  );

  if (res.rows.length === 0) {
    throw new Error('Data karyawan tidak ditemukan.');
  }

  const row = res.rows[0];
  const baseSalary = Number(row.base_salary);
  const allowance = Math.round(baseSalary * 0.25);
  const bpjsKetenagakerjaan = Math.round(baseSalary * 0.03);
  const pph21 = Math.round(baseSalary * 0.05);
  const netSalary = baseSalary + allowance - (bpjsKetenagakerjaan + pph21);

  return {
    employeeCode: row.employee_code,
    fullName: row.full_name,
    department: row.department_name,
    position: row.position_title,
    period: '2026-09',
    earnings: {
      baseSalary,
      fixedAllowance: allowance,
    },
    deductions: {
      bpjsKetenagakerjaan,
      pph21,
    },
    netSalary,
  };
}

/**
 * Mengajukan klaim reimbursement operasional / medis dengan upload bukti struk
 */
export async function submitExpenseClaim(payload: {
  employeeId: string;
  claimCategory: 'MEDICAL' | 'TRAVEL' | 'OPERATIONAL';
  amount: number;
  receiptUrl: string;
  claimDate: string;
}): Promise<ExpenseClaim> {
  const db = await getDb();
  const res = await db.query<any>(
    `INSERT INTO expense_claims (employee_id, claim_category, amount, receipt_url, claim_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *;`,
    [
      payload.employeeId,
      payload.claimCategory,
      payload.amount,
      payload.receiptUrl,
      payload.claimDate,
    ]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    claimCategory: row.claim_category,
    amount: Number(row.amount),
    receiptUrl: row.receipt_url,
    claimDate: row.claim_date,
    status: row.status,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}
