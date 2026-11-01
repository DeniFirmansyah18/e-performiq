import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { todayInJakarta } from '@/lib/utils/wibDate';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Batas maksimum satu masa perpanjangan PKWT menurut praktik ketenagakerjaan. */
const MAX_EXTENSION_MONTHS = 60;

export interface ContractActionInput {
  employeeId: string;
  effectiveDate: string;
  reason: string;
  decidedBy: string;
}

export interface ContractActionResult {
  employeeId: string;
  fullName: string;
  employmentStatus: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
}

interface EmployeeContractRow {
  id: string;
  full_name: string;
  employment_status: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
}

function assertReason(reason: string) {
  if (!reason || reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan tindakan kontrak wajib diisi (minimal 5 karakter).');
  }
}

function assertDate(value: string, field: string) {
  if (!DATE_RE.test(value)) {
    throw new BusinessRuleError(`${field} harus berformat YYYY-MM-DD.`);
  }
}

async function loadEmployee(db: Db, employeeId: string): Promise<EmployeeContractRow> {
  const res = (await db.execute(sql`
    SELECT id, full_name, employment_status::text AS employment_status,
           contract_start_date, contract_end_date
      FROM employees
     WHERE id = ${employeeId}::uuid
  `)) as unknown as { rows: EmployeeContractRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Karyawan tidak ditemukan.');
  return row;
}

async function reloadContract(db: Db, employeeId: string): Promise<ContractActionResult> {
  const res = (await db.execute(sql`
    SELECT id AS "employeeId", full_name AS "fullName",
           employment_status::text AS "employmentStatus",
           contract_start_date AS "contractStartDate",
           contract_end_date AS "contractEndDate"
      FROM employees
     WHERE id = ${employeeId}::uuid
  `)) as unknown as { rows: ContractActionResult[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Kontrak gagal dibaca setelah perubahan.');
  return {
    ...row,
    contractStartDate: row.contractStartDate ? String(row.contractStartDate).slice(0, 10) : null,
    contractEndDate: row.contractEndDate ? String(row.contractEndDate).slice(0, 10) : null,
  };
}

/**
 * Memperpanjang kontrak PKWT. Tanggal mulai kontrak baru mengikuti tanggal
 * berakhirnya kontrak lama (atau `effectiveDate` bila kontrak belum punya
 * tanggal akhir), sehingga rantai kontrak tetap bersambung dan dapat diaudit.
 */
export async function extendContract(
  db: Db,
  input: ContractActionInput & { newEndDate: string }
): Promise<ContractActionResult> {
  assertReason(input.reason);
  assertDate(input.effectiveDate, 'Tanggal keputusan');
  assertDate(input.newEndDate, 'Tanggal akhir kontrak baru');

  const emp = await loadEmployee(db, input.employeeId);
  if (emp.employment_status !== 'PKWT') {
    throw new BusinessRuleError(
      `Perpanjangan kontrak hanya berlaku untuk pegawai berstatus PKWT (saat ini ${emp.employment_status}).`
    );
  }

  const previousEnd = emp.contract_end_date
    ? String(emp.contract_end_date).slice(0, 10)
    : null;

  if (previousEnd && input.newEndDate <= previousEnd) {
    throw new BusinessRuleError(
      `Tanggal akhir kontrak baru (${input.newEndDate}) harus setelah akhir kontrak sebelumnya (${previousEnd}).`
    );
  }
  if (input.newEndDate <= input.effectiveDate) {
    throw new BusinessRuleError('Tanggal akhir kontrak baru harus setelah tanggal keputusan.');
  }

  const newStart = previousEnd ?? input.effectiveDate;

  const months =
    (Number(input.newEndDate.slice(0, 4)) - Number(newStart.slice(0, 4))) * 12 +
    (Number(input.newEndDate.slice(5, 7)) - Number(newStart.slice(5, 7)));
  if (months > MAX_EXTENSION_MONTHS) {
    throw new BusinessRuleError(
      `Masa perpanjangan ${months} bulan melebihi batas ${MAX_EXTENSION_MONTHS} bulan.`
    );
  }

  await db.execute(sql`
    UPDATE employees
       SET contract_start_date = ${newStart}::date,
           contract_end_date = ${input.newEndDate}::date
     WHERE id = ${input.employeeId}::uuid
  `);

  // Perpanjangan tidak mengubah status, jadi `employment_status_history` tidak
  // dapat dipakai (CHECK-nya menolak status yang sama). Jejak audit dicatat di
  // `audit_logs` agar kepanjangan kontrak tetap dapat ditelusuri.
  await db.execute(sql`
    INSERT INTO audit_logs (user_id, action_type, entity_name, record_id, description)
    VALUES (
      ${input.decidedBy}::uuid, 'UPDATE', 'employees', ${input.employeeId},
      ${`Perpanjangan kontrak PKWT: ${previousEnd ?? '(tanpa akhir)'} -> ${input.newEndDate}. ${input.reason.trim()}`}
    )
  `);

  return reloadContract(db, input.employeeId);
}

/**
 * Mengakhiri PKWT dan mengangkat pegawai menjadi pegawai tetap (PKWTT).
 * `appointment_date` diisi agar tanggal pengangkatan tercatat resmi.
 */
export async function convertToPermanent(
  db: Db,
  input: ContractActionInput
): Promise<ContractActionResult> {
  assertReason(input.reason);
  assertDate(input.effectiveDate, 'Tanggal pengangkatan');

  const emp = await loadEmployee(db, input.employeeId);
  if (emp.employment_status !== 'PKWT') {
    throw new BusinessRuleError(
      `Transisi ke pegawai tetap hanya berlaku untuk PKWT (saat ini ${emp.employment_status}).`
    );
  }

  await db.execute(sql`
    WITH prev AS (
      SELECT employment_status FROM employees WHERE id = ${input.employeeId}::uuid
    ), upd AS (
      UPDATE employees
         SET employment_status = 'PKWTT'::employment_status_enum,
             appointment_date = ${input.effectiveDate}::date,
             status = 'PERMANENT'::employee_status_enum
       WHERE id = ${input.employeeId}::uuid
      RETURNING id
    )
    INSERT INTO employment_status_history
      (employee_id, previous_status, new_status, effective_date, reason, decided_by)
    SELECT ${input.employeeId}::uuid, prev.employment_status,
           'PKWTT'::employment_status_enum, ${input.effectiveDate}::date,
           ${input.reason.trim()}, ${input.decidedBy}::uuid
      FROM prev
  `);

  await db.execute(sql`
    INSERT INTO audit_logs (user_id, action_type, entity_name, record_id, description)
    VALUES (
      ${input.decidedBy}::uuid, 'UPDATE', 'employees', ${input.employeeId},
      ${`Transisi PKWT -> PKWTT per ${input.effectiveDate}. ${input.reason.trim()}`}
    )
  `);

  return reloadContract(db, input.employeeId);
}

/** Tanggal acuan bawaan untuk perhitungan sisa kontrak. */
export function defaultEffectiveDate(): string {
  return todayInJakarta();
}
