import { getDb, type SqlClient } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import type { ExpenseClaim } from '@/types';
import {
  validasiKeputusanKlaim,
  bolehPutuskan,
  masihMenunggu,
  STATUS_DISETUJUI,
  STATUS_DITOLAK,
} from '@/lib/services/expenseClaimDecision';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/auth/errors';

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
  const db = await getDb();
  const res = await db.query<any>(
    `SELECT e.id, e.employee_code, e.full_name, e.base_salary, e.payslip_pin_hash,
            d.department_name, j.position_title
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

  // Task 10: verifikasi PIN memakai hash bcrypt per karyawan, bukan literal '123456'
  if (!row.payslip_pin_hash) {
    throw new Error('PIN keamanan belum diatur. Hubungi HR untuk aktivasi slip gaji digital.');
  }
  const pinValid = await verifyPassword(payload.pin, row.payslip_pin_hash);
  if (!pinValid) {
    throw new Error('PIN keamanan tidak valid.');
  }
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
export async function submitExpenseClaim(
  payload: {
    employeeId: string;
    claimCategory: 'MEDICAL' | 'TRAVEL' | 'OPERATIONAL';
    amount: number;
    receiptUrl: string;
    claimDate: string;
  },
  /** Opsional: dipakai pengujian agar tidak menyentuh koneksi global. */
  dbInjeksi?: SqlClient
): Promise<ExpenseClaim> {
  const db = dbInjeksi ?? (await getDb());
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

/** Satu baris klaim untuk tinjauan HR (termasuk identitas pengaju). */
export interface KlaimUntukHr extends ExpenseClaim {
  employeeCode: string | null;
  employeeName: string;
  departmentName: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  approvedAmount: number | null;
}

/** Baris mentah expense_claims (snake_case) menjadi bentuk klaim untuk HR. */
function keKlaimUntukHr(row: any): KlaimUntukHr {
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
    employeeCode: row.employee_code ?? null,
    employeeName: row.full_name ?? '-',
    departmentName: row.department_name ?? null,
    decidedByName: row.decided_by_name ?? null,
    decisionNote: row.decision_note ?? null,
    approvedAmount: row.approved_amount == null ? null : Number(row.approved_amount),
  };
}

/**
 * Daftar klaim reimbursement untuk ditinjau HR/Finance.
 *
 * Tanpa `status` berarti semua status (terbaru lebih dulu), sehingga HR dapat
 * melihat antrean menunggu keputusan maupun riwayat yang sudah diputuskan.
 */
export async function listExpenseClaimsForHr(
  options: { status?: string | null; employeeId?: string | null } = {},
  dbInjeksi?: SqlClient
): Promise<KlaimUntukHr[]> {
  const db = dbInjeksi ?? (await getDb());
  const res = await db.query<any>(
    `SELECT ec.*, e.employee_code, e.full_name, d.department_name,
            u.email AS decided_by_name
       FROM expense_claims ec
       JOIN employees e ON e.id = ec.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN users u ON u.id = ec.decided_by
      WHERE ($1::text IS NULL OR ec.status = $1)
        AND ($2::uuid IS NULL OR ec.employee_id = $2)
      ORDER BY ec.claim_date DESC, ec.created_at DESC`,
    [options.status ?? null, options.employeeId ?? null]
  );
  return (res.rows ?? []).map(keKlaimUntukHr);
}

/**
 * Satu klaim reimbursement beserta identitas pengaju dan pemutusnya.
 *
 * Difilter di basis data (bukan memuat semua klaim lalu mencari di memori),
 * karena endpoint detail dipanggil per klaim.
 */
export async function getExpenseClaimById(
  claimId: string,
  dbInjeksi?: SqlClient
): Promise<KlaimUntukHr | null> {
  const db = dbInjeksi ?? (await getDb());
  const res = (await db.query<any>(
    `SELECT ec.*, e.employee_code, e.full_name, d.department_name,
            u.email AS decided_by_name
       FROM expense_claims ec
       JOIN employees e ON e.id = ec.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN users u ON u.id = ec.decided_by
      WHERE ec.id = $1`,
    [claimId]
  )) as unknown as { rows: any[] };
  const row = res.rows?.[0];
  return row ? keKlaimUntukHr(row) : null;
}

/**
 * Putuskan klaim reimbursement: setujui PENUH atau tolak.
 *
 * Aturan (lihat expenseClaimDecision):
 *   - hanya klaim berstatus SUBMITTED yang dapat diputuskan,
 *   - penolakan WAJIB disertai alasan,
 *   - kebijakan perusahaan: tidak ada persetujuan sebagian. Nominal yang
 *     disetujui SELALU sama dengan pengajuan. Pemanggil tidak dapat mengirim
 *     nominal lain (parameter `disetujui` pada service ini sudah dihapus).
 */
export async function decideExpenseClaim(input: {
  claimId: string;
  keputusan: 'APPROVED' | 'REJECTED';
  catatan?: string | null;
  decidedByUserId: string;
  peran: string;
  /** Opsional: dipakai pengujian agar tidak menyentuh koneksi global. */
  dbInjeksi?: SqlClient;
}): Promise<KlaimUntukHr> {
  if (!bolehPutuskan(input.peran)) {
    throw new ForbiddenError('Hanya HR/Finance atau BOD yang dapat memutuskan klaim reimbursement.');
  }

  const db = input.dbInjeksi ?? (await getDb());
  const cari = await db.query<any>(
    `SELECT id, status, amount FROM expense_claims WHERE id = $1`,
    [input.claimId]
  );
  const klaim = cari.rows?.[0];
  if (!klaim) throw new NotFoundError('Klaim reimbursement tidak ditemukan.');

  const diajukan = Number(klaim.amount);
  // Kebijakan perusahaan: setujui penuh. Nominal mengikuti pengajuan apa adanya.
  const disetujui = input.keputusan === 'APPROVED' ? diajukan : 0;

  const cek = validasiKeputusanKlaim({
    statusSekarang: String(klaim.status),
    keputusan: input.keputusan,
    disetujui,
    diajukan,
    catatan: input.catatan ?? undefined,
  });
  if (!cek.ok) throw new BusinessRuleError(String(cek.pesan));

  const hasil = await db.query<any>(
    `UPDATE expense_claims
        SET status = $2,
            processed_at = CURRENT_TIMESTAMP,
            decided_by = $3,
            decision_note = $4,
            approved_amount = $5
      WHERE id = $1
      RETURNING id`,
    [
      input.claimId,
      input.keputusan === 'APPROVED' ? STATUS_DISETUJUI : STATUS_DITOLAK,
      input.decidedByUserId,
      input.catatan?.trim() || null,
      disetujui,
    ]
  );
  if (!hasil.rows?.length) throw new NotFoundError('Klaim reimbursement tidak ditemukan.');

  // Baca ulang lewat koneksi yang sama agar hasil uji konsisten.
  const semua = await listExpenseClaimsForHr({}, db);
  const baru = semua.find((k) => k.id === input.claimId);
  if (!baru) throw new NotFoundError('Klaim reimbursement tidak ditemukan.');
  return baru;
}
