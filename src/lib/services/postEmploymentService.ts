/**
 * Layanan fase Pasca-Kerja: pensiun, serah terima aset, surat pengalaman kerja,
 * kepatuhan pasca-kerja, dan direktori alumni.
 *
 * Semua fungsi menerima `Db` agar bisa diuji dengan database in-memory, dan
 * memakai SQL biasa (bukan ORM) mengikuti pola `offboardingService`.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError, NotFoundError } from '@/lib/auth/errors';
import { todayInJakarta } from '@/lib/utils/wibDate';

const MS_PER_DAY = 86_400_000;

/** Usia pensiun normal mengikuti praktik umum Indonesia (UU 13/2003 Pasal 167). */
export const RETIREMENT_AGE = 58;

export const SUCCESSOR_READINESS_LABEL: Record<string, string> = {
  NOT_ASSESSED: 'Belum dinilai',
  NOT_READY: 'Belum siap',
  DEVELOPING: 'Sedang disiapkan',
  READY: 'Siap dalam 1 tahun',
  READY_NOW: 'Siap sekarang',
};

export const KNOWLEDGE_TRANSFER_LABEL: Record<string, string> = {
  NOT_STARTED: 'Belum dimulai',
  IN_PROGRESS: 'Berjalan',
  COMPLETED: 'Selesai',
};

export const ASSET_CATEGORY_LABEL: Record<string, string> = {
  LAPTOP: 'Laptop',
  PHONE: 'Telepon seluler',
  ACCESS_CARD: 'Kartu akses',
  VEHICLE: 'Kendaraan',
  DOCUMENT: 'Dokumen',
  CREDENTIAL: 'Akun & kredensial sistem',
  OTHER: 'Lainnya',
};

export const CLEARANCE_DEPARTMENT_LABEL: Record<string, string> = {
  HR: 'Kepegawaian',
  IT: 'Teknologi Informasi',
  FINANCE: 'Keuangan',
  MANAGER: 'Atasan langsung',
  LEGAL: 'Hukum & Kepatuhan',
};

export const LETTER_TYPE_LABEL: Record<string, string> = {
  EXPERIENCE: 'Surat Pengalaman Kerja',
  REFERENCE: 'Surat Referensi',
  SALARY: 'Surat Keterangan Penghasilan',
  EMPLOYMENT: 'Surat Keterangan Kerja',
};

export const OBLIGATION_LABEL: Record<string, string> = {
  BPJS_KES_DEACTIVATE: 'Nonaktifkan kepesertaan BPJS Kesehatan',
  BPJS_TK_DEACTIVATE: 'Nonaktifkan kepesertaan BPJS Ketenagakerjaan',
  TAX_FORM_1721A1: 'Terbitkan bukti potong pajak 1721-A1',
  DPLK_SETTLEMENT: 'Selesaikan pencairan DPLK',
  PENSION_FILE_CLOSE: 'Tutup berkas pensiun',
  ASSET_RETURN_LETTER: 'Terbitkan berita acara pengembalian aset',
};

/** Predikat karyawan aktif yang dipakai konsisten di seluruh aplikasi. */
const ACTIVE_PREDICATE = sql`
  e.status NOT IN ('RESIGNED','RETIRED')
  AND COALESCE(e.employment_status::text,'') NOT IN ('RESIGNED','RETIRED')
`;

function todayIso(): string {
  return todayInJakarta();
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

function toIsoDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ============================================================
// 1. MANAJEMEN PENSIUN
// ============================================================

export interface RetirementCandidate {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  joinDate: string;
  birthDate: string | null;
  plannedRetirementDate: string;
  daysToRetirement: number;
  age: number | null;
  planId: string | null;
  successorEmployeeId: string | null;
  successorName: string | null;
  successorReadiness: string;
  successorshipLabel: string;
  knowledgeTransferStatus: string;
  knowledgeTransferLabel: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RetirementOverview {
  candidates: RetirementCandidate[];
  summary: {
    dueWithin12Months: number;
    dueWithin5Years: number;
    withoutSuccessor: number;
    withoutBirthDate: number;
    coveredPercentage: number;
  };
}

/**
 * Daftar karyawan aktif yang mendekati usia pensiun.
 *
 * Tanggal pensiun diambil dari `retirement_plans` bila sudah direncanakan;
 * jika belum, diproyeksikan dari tanggal lahir + `RETIREMENT_AGE`.
 */
export async function getRetirementOverview(db: Db): Promise<RetirementOverview> {
  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId",
           e.employee_code AS "employeeCode",
           e.full_name AS "fullName",
           d.department_name AS "departmentName",
           jp.position_title AS "positionTitle",
           e.join_date AS "joinDate",
           e.birth_date AS "birthDate",
           e.retirement_date AS "retirementDate",
           rp.id AS "planId",
           rp.planned_retirement_date AS "plannedRetirementDate",
           rp.successor_employee_id AS "successorEmployeeId",
           s.full_name AS "successorName",
           rp.successor_readiness AS "successorReadiness",
           rp.knowledge_transfer_status AS "knowledgeTransferStatus"
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      JOIN job_positions jp ON jp.id = e.position_id
      LEFT JOIN retirement_plans rp ON rp.employee_id = e.id
      LEFT JOIN employees s ON s.id = rp.successor_employee_id
     WHERE ${ACTIVE_PREDICATE}
       AND (e.birth_date IS NOT NULL OR rp.planned_retirement_date IS NOT NULL)
     ORDER BY COALESCE(rp.planned_retirement_date,
                       (e.birth_date + (${RETIREMENT_AGE} || ' years')::interval)::date) ASC
  `)) as unknown as { rows: any[] };

  const today = todayIso();
  const candidates: RetirementCandidate[] = res.rows.map((row) => {
    const birthDate = row.birthDate ? toIsoDate(row.birthDate) : null;
    const planned =
      toIsoDate(row.plannedRetirementDate) ||
      toIsoDate(row.retirementDate) ||
      projectedRetirementDate(birthDate);
    const days = planned ? daysBetween(today, planned) : 0;
    return {
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      departmentName: row.departmentName,
      positionTitle: row.positionTitle,
      joinDate: toIsoDate(row.joinDate),
      birthDate,
      plannedRetirementDate: planned,
      daysToRetirement: days,
      age: birthDate ? Math.floor(-daysBetween(birthDate, today) / 365.25) : null,
      planId: row.planId ?? null,
      successorEmployeeId: row.successorEmployeeId ?? null,
      successorName: row.successorName ?? null,
      successorReadiness: row.successorReadiness ?? 'NOT_ASSESSED',
      successorshipLabel: SUCCESSOR_READINESS_LABEL[row.successorReadiness ?? 'NOT_ASSESSED'],
      knowledgeTransferStatus: row.knowledgeTransferStatus ?? 'NOT_STARTED',
      knowledgeTransferLabel: KNOWLEDGE_TRANSFER_LABEL[row.knowledgeTransferStatus ?? 'NOT_STARTED'],
      riskLevel: days <= 365 ? 'HIGH' : days <= 365 * 3 ? 'MEDIUM' : 'LOW',
    };
  });

  const dueWithin12Months = candidates.filter((c) => c.daysToRetirement <= 365).length;
  const dueWithin5Years = candidates.filter((c) => c.daysToRetirement <= 365 * 5).length;
  const withoutSuccessor = candidates.filter((c) => !c.successorEmployeeId).length;
  const covered = candidates.length - withoutSuccessor;

  return {
    candidates,
    summary: {
      dueWithin12Months,
      dueWithin5Years,
      withoutSuccessor,
      withoutBirthDate: candidates.filter((c) => !c.birthDate).length,
      coveredPercentage: candidates.length > 0 ? Math.round((covered / candidates.length) * 1000) / 10 : 0,
    },
  };
}

function projectedRetirementDate(birthDate: string | null): string {
  if (!birthDate) return '';
  const d = new Date(`${birthDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + RETIREMENT_AGE);
  return d.toISOString().slice(0, 10);
}

export interface RetirementPlanInput {
  employeeId: string;
  plannedRetirementDate: string;
  successorEmployeeId?: string | null;
  successorReadiness?: string;
  knowledgeTransferStatus?: string;
  notes?: string | null;
}

/** Simpan/ubah rencana pensiun. Idempoten lewat UNIQUE(employee_id). */
export async function upsertRetirementPlan(db: Db, input: RetirementPlanInput) {
  if (!input.employeeId) throw new BusinessRuleError('Karyawan wajib dipilih.');
  if (!input.plannedRetirementDate) {
    throw new BusinessRuleError('Tanggal pensiun wajib diisi.');
  }
  if (input.successorEmployeeId && input.successorEmployeeId === input.employeeId) {
    throw new BusinessRuleError('Pengganti tidak boleh karyawan yang sama.');
  }

  const employee = (await db.execute(sql`
    SELECT id FROM employees WHERE id = ${input.employeeId}::uuid
  `)) as unknown as { rows: any[] };
  if (!employee.rows[0]) throw new NotFoundError('Karyawan tidak ditemukan.');

  const readiness = input.successorReadiness ?? 'NOT_ASSESSED';
  const transfer = input.knowledgeTransferStatus ?? 'NOT_STARTED';

  const res = (await db.execute(sql`
    INSERT INTO retirement_plans
      (employee_id, planned_retirement_date, successor_employee_id,
       successor_readiness, knowledge_transfer_status, notes)
    VALUES (${input.employeeId}::uuid, ${input.plannedRetirementDate}::date,
            ${input.successorEmployeeId ?? null}::uuid, ${readiness}, ${transfer},
            ${input.notes ?? null})
    ON CONFLICT (employee_id) DO UPDATE
      SET planned_retirement_date = EXCLUDED.planned_retirement_date,
          successor_employee_id = EXCLUDED.successor_employee_id,
          successor_readiness = EXCLUDED.successor_readiness,
          knowledge_transfer_status = EXCLUDED.knowledge_transfer_status,
          notes = EXCLUDED.notes,
          updated_at = CURRENT_TIMESTAMP
    RETURNING id, employee_id AS "employeeId",
              planned_retirement_date AS "plannedRetirementDate"
  `)) as unknown as { rows: any[] };

  const row = res.rows[0];
  return {
    id: row.id,
    employeeId: row.employeeId,
    plannedRetirementDate: toIsoDate(row.plannedRetirementDate),
    successorEmployeeId: input.successorEmployeeId ?? null,
    successorReadiness: readiness,
    successorshipLabel: SUCCESSOR_READINESS_LABEL[readiness] ?? readiness,
    knowledgeTransferStatus: transfer,
    knowledgeTransferLabel: KNOWLEDGE_TRANSFER_LABEL[transfer] ?? transfer,
  };
}

// ============================================================
// 2. SERAH TERIMA & PENGEMBALIAN ASET
// ============================================================

export interface ClearanceAsset {
  id: string;
  assetName: string;
  assetCategory: string;
  categoryLabel: string;
  assetCode: string | null;
  isReturned: boolean;
  returnedAt: string | null;
  notes: string | null;
}

export interface ClearanceSignoff {
  id: string;
  department: string;
  departmentLabel: string;
  isCleared: boolean;
  clearedAt: string | null;
  notes: string | null;
}

export interface ClearanceOverview {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  lastWorkingDay: string | null;
  assets: ClearanceAsset[];
  signoffs: ClearanceSignoff[];
  summary: {
    assetsTotal: number;
    assetsReturned: number;
    signoffTotal: number;
    signoffCleared: number;
    completionPercentage: number;
    isFullyCleared: boolean;
  };
}

/**
 * Checklist clearance satu karyawan. Bila karyawan belum punya baris aset,
 * dibuatkan template awal sesuai kategori yang lazim agar HR punya titik mulai.
 */
export async function getClearanceOverview(db: Db, employeeId: string): Promise<ClearanceOverview> {
  const emp = (await db.execute(sql`
    SELECT e.id, e.employee_code AS "employeeCode", e.full_name AS "fullName",
           COALESCE(e.last_working_day, o.last_working_day) AS "lastWorkingDay"
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT last_working_day FROM offboarding_requests
         WHERE employee_id = e.id
         ORDER BY created_at DESC LIMIT 1
      ) o ON TRUE
     WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: any[] };
  const employee = emp.rows[0];
  if (!employee) throw new NotFoundError('Karyawan tidak ditemukan.');

  const assets = (await db.execute(sql`
    SELECT id, asset_name AS "assetName", asset_category AS "assetCategory",
           asset_code AS "assetCode", is_returned AS "isReturned",
           returned_at AS "returnedAt", notes
      FROM clearance_assets
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY asset_category, asset_name
  `)) as unknown as { rows: any[] };

  const signoffs = (await db.execute(sql`
    SELECT id, department, is_cleared AS "isCleared",
           cleared_at AS "clearedAt", notes
      FROM clearance_signoffs
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY department
  `)) as unknown as { rows: any[] };

  const assetRows: ClearanceAsset[] = assets.rows.map((r) => ({
    id: r.id,
    assetName: r.assetName,
    assetCategory: r.assetCategory,
    categoryLabel: ASSET_CATEGORY_LABEL[r.assetCategory] ?? r.assetCategory,
    assetCode: r.assetCode ?? null,
    isReturned: !!r.isReturned,
    returnedAt: r.returnedAt ? new Date(r.returnedAt).toISOString() : null,
    notes: r.notes ?? null,
  }));

  const signoffRows: ClearanceSignoff[] = signoffs.rows.map((r) => ({
    id: r.id,
    department: r.department,
    departmentLabel: CLEARANCE_DEPARTMENT_LABEL[r.department] ?? r.department,
    isCleared: !!r.isCleared,
    clearedAt: r.clearedAt ? new Date(r.clearedAt).toISOString() : null,
    notes: r.notes ?? null,
  }));

  const assetsReturned = assetRows.filter((a) => a.isReturned).length;
  const signoffCleared = signoffRows.filter((s) => s.isCleared).length;
  const total = assetRows.length + signoffRows.length;
  const done = assetsReturned + signoffCleared;

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    lastWorkingDay: employee.lastWorkingDay ? toIsoDate(employee.lastWorkingDay) : null,
    assets: assetRows,
    signoffs: signoffRows,
    summary: {
      assetsTotal: assetRows.length,
      assetsReturned,
      signoffTotal: signoffRows.length,
      signoffCleared,
      completionPercentage: total > 0 ? Math.round((done / total) * 1000) / 10 : 0,
      isFullyCleared: total > 0 && done === total,
    },
  };
}

/** Tambah satu baris aset ke checklist clearance karyawan. */
export async function addClearanceAsset(
  db: Db,
  input: {
    employeeId: string;
    assetName: string;
    assetCategory?: string;
    assetCode?: string | null;
    notes?: string | null;
  }
) {
  if (!input.employeeId) throw new BusinessRuleError('Karyawan wajib dipilih.');
  if (!input.assetName?.trim()) throw new BusinessRuleError('Nama aset wajib diisi.');

  const category = input.assetCategory ?? 'OTHER';
  const res = (await db.execute(sql`
    INSERT INTO clearance_assets
      (employee_id, asset_name, asset_category, asset_code, notes)
    VALUES (${input.employeeId}::uuid, ${input.assetName.trim()}, ${category},
            ${input.assetCode ?? null}, ${input.notes ?? null})
    RETURNING id, asset_name AS "assetName", asset_category AS "assetCategory",
              asset_code AS "assetCode", is_returned AS "isReturned",
              notes
  `)) as unknown as { rows: any[] };
  const r = res.rows[0];
  return {
    id: r.id,
    assetName: r.assetName,
    assetCategory: r.assetCategory,
    categoryLabel: ASSET_CATEGORY_LABEL[r.assetCategory] ?? r.assetCategory,
    assetCode: r.assetCode ?? null,
    isReturned: !!r.isReturned,
    returnedAt: null,
    notes: r.notes ?? null,
  };
}

/** Tandai aset sudah/belum dikembalikan. */
export async function setAssetReturned(
  db: Db,
  assetId: string,
  isReturned: boolean,
  verifiedBy?: string | null
) {
  const res = (await db.execute(sql`
    UPDATE clearance_assets
       SET is_returned = ${isReturned},
           returned_at = ${isReturned ? sql`CURRENT_TIMESTAMP` : sql`NULL`},
           verified_by = ${isReturned ? (verifiedBy ?? null) : null}::uuid
     WHERE id = ${assetId}::uuid
    RETURNING id, is_returned AS "isReturned", returned_at AS "returnedAt"
  `)) as unknown as { rows: any[] };
  const row = res.rows[0];
  if (!row) throw new NotFoundError('Aset tidak ditemukan.');
  return {
    id: row.id,
    isReturned: !!row.isReturned,
    returnedAt: row.returnedAt ? new Date(row.returnedAt).toISOString() : null,
  };
}

/** Hapus satu baris aset dari checklist. */
export async function removeClearanceAsset(db: Db, assetId: string) {
  const res = (await db.execute(sql`
    DELETE FROM clearance_assets WHERE id = ${assetId}::uuid RETURNING id
  `)) as unknown as { rows: any[] };
  if (!res.rows[0]) throw new NotFoundError('Aset tidak ditemukan.');
  return { id: assetId };
}

const VALID_DEPARTMENTS = ['HR', 'IT', 'FINANCE', 'MANAGER', 'LEGAL'];

/** Setujui / batalkan sign-off satu unit kerja. */
export async function setClearanceSignoff(
  db: Db,
  input: {
    employeeId: string;
    department: string;
    isCleared: boolean;
    clearedBy?: string | null;
    notes?: string | null;
  }
) {
  if (!VALID_DEPARTMENTS.includes(input.department)) {
    throw new BusinessRuleError('Unit kerja clearance tidak dikenal.');
  }
  const res = (await db.execute(sql`
    INSERT INTO clearance_signoffs
      (employee_id, department, is_cleared, cleared_by, cleared_at, notes)
    VALUES (${input.employeeId}::uuid, ${input.department}, ${input.isCleared},
            ${input.isCleared ? (input.clearedBy ?? null) : null}::uuid,
            ${input.isCleared ? sql`CURRENT_TIMESTAMP` : sql`NULL`},
            ${input.notes ?? null})
    ON CONFLICT (employee_id, department) DO UPDATE
      SET is_cleared = EXCLUDED.is_cleared,
          cleared_by = EXCLUDED.cleared_by,
          cleared_at = EXCLUDED.cleared_at,
          notes = COALESCE(EXCLUDED.notes, clearance_signoffs.notes)
    RETURNING id, department, is_cleared AS "isCleared", cleared_at AS "clearedAt", notes
  `)) as unknown as { rows: any[] };
  const r = res.rows[0];
  return {
    id: r.id,
    department: r.department,
    departmentLabel: CLEARANCE_DEPARTMENT_LABEL[r.department] ?? r.department,
    isCleared: !!r.isCleared,
    clearedAt: r.clearedAt ? new Date(r.clearedAt).toISOString() : null,
    notes: r.notes ?? null,
  };
}

// ============================================================
// 3. SURAT PENGALAMAN KERJA & SERTIFIKAT
// ============================================================

export interface ServiceLetterRow {
  id: string;
  letterNumber: string;
  verificationCode: string;
  letterType: string;
  letterTypeLabel: string;
  issuedDate: string;
  positionTitle: string;
  departmentName: string;
  startDate: string;
  endDate: string;
  purpose: string | null;
  employeeName?: string;
  employeeCode?: string;
}

export async function listServiceLetters(db: Db, employeeId?: string): Promise<ServiceLetterRow[]> {
  const res = (await db.execute(sql`
    SELECT sl.id, sl.letter_number AS "letterNumber",
           sl.verification_code AS "verificationCode",
           sl.letter_type AS "letterType", sl.issued_date AS "issuedDate",
           sl.position_title AS "positionTitle", sl.department_name AS "departmentName",
           sl.start_date AS "startDate", sl.end_date AS "endDate", sl.purpose,
           e.full_name AS "employeeName", e.employee_code AS "employeeCode"
      FROM service_letters sl
      JOIN employees e ON e.id = sl.employee_id
     ${employeeId ? sql`WHERE sl.employee_id = ${employeeId}::uuid` : sql``}
     ORDER BY sl.issued_date DESC, sl.letter_number DESC
     LIMIT 200
  `)) as unknown as { rows: any[] };
  return res.rows.map((r) => ({
    id: r.id,
    letterNumber: r.letterNumber,
    verificationCode: r.verificationCode,
    letterType: r.letterType,
    letterTypeLabel: LETTER_TYPE_LABEL[r.letterType] ?? r.letterType,
    issuedDate: toIsoDate(r.issuedDate),
    positionTitle: r.positionTitle,
    departmentName: r.departmentName,
    startDate: toIsoDate(r.startDate),
    endDate: toIsoDate(r.endDate),
    purpose: r.purpose ?? null,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
  }));
}

/** Nomor surat berurutan per bulan: 001/SPK/HRCC/2026-10. */
async function nextLetterNumber(db: Db, type: string): Promise<string> {
  const code = type === 'REFERENCE' ? 'SRF' : type === 'SALARY' ? 'SKP' : 'SPK';
  const res = (await db.execute(sql`
    SELECT COUNT(*)::int AS "total" FROM service_letters
     WHERE issued_date >= date_trunc('month', CURRENT_DATE)
       AND issued_date < date_trunc('month', CURRENT_DATE) + interval '1 month'
  `)) as unknown as { rows: any[] };
  const seq = String(num(res.rows[0]?.total) + 1).padStart(3, '0');
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${seq}/${code}/HRCC/${period}`;
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Terbitkan surat pengalaman/referensi. Data jabatan & departemen disalin dari
 * profil saat terbit agar surat tetap akurat setelah data diubah.
 */
export async function issueServiceLetter(
  db: Db,
  input: {
    employeeId: string;
    letterType?: string;
    endDate?: string;
    purpose?: string | null;
    notes?: string | null;
    issuedBy?: string | null;
  }
): Promise<ServiceLetterRow> {
  if (!input.employeeId) throw new BusinessRuleError('Karyawan wajib dipilih.');
  const type = input.letterType ?? 'EXPERIENCE';

  const emp = (await db.execute(sql`
    SELECT e.full_name, e.join_date AS "joinDate",
           COALESCE(e.last_working_day, CURRENT_DATE) AS "endDate",
           jp.position_title AS "positionTitle", d.department_name AS "departmentName"
      FROM employees e
      JOIN job_positions jp ON jp.id = e.position_id
      JOIN departments d ON d.id = e.department_id
     WHERE e.id = ${input.employeeId}::uuid
  `)) as unknown as { rows: any[] };
  const e = emp.rows[0];
  if (!e) throw new NotFoundError('Karyawan tidak ditemukan.');

  const endDate = input.endDate || toIsoDate(e.endDate);
  const startDate = toIsoDate(e.joinDate);
  if (Date.parse(endDate) < Date.parse(startDate)) {
    throw new BusinessRuleError('Tanggal akhir tidak boleh sebelum tanggal mulai kerja.');
  }

  const letterNumber = await nextLetterNumber(db, type);
  const verificationCode = randomCode();

  const res = (await db.execute(sql`
    INSERT INTO service_letters
      (employee_id, letter_number, verification_code, letter_type, issued_date,
       position_title, department_name, start_date, end_date, purpose, notes, issued_by)
    VALUES (${input.employeeId}::uuid, ${letterNumber}, ${verificationCode}, ${type},
            CURRENT_DATE, ${e.positionTitle}, ${e.departmentName},
            ${startDate}::date, ${endDate}::date, ${input.purpose ?? null},
            ${input.notes ?? null}, ${input.issuedBy ?? null}::uuid)
    RETURNING id, letter_number AS "letterNumber",
              verification_code AS "verificationCode", letter_type AS "letterType",
              issued_date AS "issuedDate", position_title AS "positionTitle",
              department_name AS "departmentName", start_date AS "startDate",
              end_date AS "endDate", purpose
  `)) as unknown as { rows: any[] };
  const r = res.rows[0];
  return {
    id: r.id,
    letterNumber: r.letterNumber,
    verificationCode: r.verificationCode,
    letterType: r.letterType,
    letterTypeLabel: LETTER_TYPE_LABEL[r.letterType] ?? r.letterType,
    issuedDate: toIsoDate(r.issuedDate),
    positionTitle: r.positionTitle,
    departmentName: r.departmentName,
    startDate: toIsoDate(r.startDate),
    endDate: toIsoDate(r.endDate),
    purpose: r.purpose ?? null,
    employeeName: e.full_name,
  };
}

/** Verifikasi publik sebuah surat lewat kode (tanpa sesi). */
export async function verifyServiceLetter(db: Db, code: string) {
  const res = (await db.execute(sql`
    SELECT sl.letter_number AS "letterNumber", sl.letter_type AS "letterType",
           sl.issued_date AS "issuedDate", sl.position_title AS "positionTitle",
           sl.department_name AS "departmentName", sl.start_date AS "startDate",
           sl.end_date AS "endDate", e.full_name AS "employeeName"
      FROM service_letters sl
      JOIN employees e ON e.id = sl.employee_id
     WHERE UPPER(sl.verification_code) = UPPER(${code})
     LIMIT 1
  `)) as unknown as { rows: any[] };
  const r = res.rows[0];
  if (!r) return null;
  return {
    isValid: true,
    letterNumber: r.letterNumber,
    letterType: r.letterType,
    letterTypeLabel: LETTER_TYPE_LABEL[r.letterType] ?? r.letterType,
    issuedDate: toIsoDate(r.issuedDate),
    positionTitle: r.positionTitle,
    departmentName: r.departmentName,
    startDate: toIsoDate(r.startDate),
    endDate: toIsoDate(r.endDate),
    employeeName: r.employeeName,
  };
}

/** Teks surat siap cetak (dipakai endpoint teks biasa dan pratinjau di layar). */
export function renderServiceLetterText(
  letter: {
    letterNumber: string;
    letterTypeLabel: string;
    issuedDate: string;
    positionTitle: string;
    departmentName: string;
    startDate: string;
    endDate: string;
    employeeName: string;
    verificationCode: string;
    purpose?: string | null;
  }
): string {
  const fmt = (iso: string) =>
    iso
      ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : '-';
  return [
    'HR COMMAND CENTER',
    'PT NUSANTARA HUMAN CAPITAL',
    '',
    `Nomor: ${letter.letterNumber}`,
    '',
    letter.letterTypeLabel.toUpperCase(),
    '',
    'Yang bertanda tangan di bawah ini menerangkan bahwa:',
    `Nama              : ${letter.employeeName}`,
    `Jabatan terakhir  : ${letter.positionTitle}`,
    `Unit kerja        : ${letter.departmentName}`,
    `Masa kerja        : ${fmt(letter.startDate)} sampai ${fmt(letter.endDate)}`,
    '',
    letter.purpose
      ? `Surat ini diterbitkan untuk keperluan: ${letter.purpose}.`
      : 'Surat ini diterbitkan untuk keperluan administratif yang sah.',
    '',
    'Selama bekerja, yang bersangkutan menunjukkan kinerja dan perilaku sesuai',
    'ketentuan perusahaan. Demikian surat ini dibuat dengan sebenarnya.',
    '',
    `Tanggal terbit    : ${fmt(letter.issuedDate)}`,
    `Kode verifikasi   : ${letter.verificationCode}`,
    '',
    'Keabsahan surat dapat diperiksa pada halaman verifikasi aplikasi',
    'dengan memasukkan kode verifikasi di atas.',
  ].join('\n');
}

// ============================================================
// 4. KEPATUHAN PASCA-KERJA
// ============================================================

export interface ObligationRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  obligationCode: string;
  title: string;
  dueDate: string;
  daysRemaining: number;
  isCompleted: boolean;
  completedAt: string | null;
  referenceNo: string | null;
  notes: string | null;
  status: 'DONE' | 'OVERDUE' | 'DUE_SOON' | 'OPEN';
  statusLabel: string;
}

export interface ObligationOverview {
  obligations: ObligationRow[];
  summary: {
    total: number;
    done: number;
    overdue: number;
    dueSoon: number;
    completionPercentage: number;
    employeesWithoutObligations: number;
  };
}

const DEFAULT_OBLIGATIONS: Array<{ code: string; dueOffsetDays: number }> = [
  { code: 'BPJS_KES_DEACTIVATE', dueOffsetDays: 7 },
  { code: 'BPJS_TK_DEACTIVATE', dueOffsetDays: 7 },
  { code: 'TAX_FORM_1721A1', dueOffsetDays: 30 },
  { code: 'DPLK_SETTLEMENT', dueOffsetDays: 30 },
  { code: 'PENSION_FILE_CLOSE', dueOffsetDays: 45 },
  { code: 'ASSET_RETURN_LETTER', dueOffsetDays: 14 },
];

export async function getObligationOverview(db: Db): Promise<ObligationOverview> {
  const res = (await db.execute(sql`
    SELECT o.id, o.employee_id AS "employeeId", e.full_name AS "employeeName",
           e.employee_code AS "employeeCode", o.obligation_code AS "obligationCode",
           o.title, o.due_date AS "dueDate", o.is_completed AS "isCompleted",
           o.completed_at AS "completedAt", o.reference_no AS "referenceNo", o.notes
      FROM post_employment_obligations o
      JOIN employees e ON e.id = o.employee_id
     ORDER BY o.is_completed ASC, o.due_date ASC
     LIMIT 500
  `)) as unknown as { rows: any[] };

  const today = todayIso();
  const obligations: ObligationRow[] = res.rows.map((r) => {
    const dueDate = toIsoDate(r.dueDate);
    const daysRemaining = daysBetween(today, dueDate);
    const isCompleted = !!r.isCompleted;
    const status: ObligationRow['status'] = isCompleted
      ? 'DONE'
      : daysRemaining < 0
        ? 'OVERDUE'
        : daysRemaining <= 14
          ? 'DUE_SOON'
          : 'OPEN';
    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      employeeCode: r.employeeCode,
      obligationCode: r.obligationCode,
      title: r.title,
      dueDate,
      daysRemaining,
      isCompleted,
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
      referenceNo: r.referenceNo ?? null,
      notes: r.notes ?? null,
      status,
      statusLabel:
        status === 'DONE'
          ? 'Selesai'
          : status === 'OVERDUE'
            ? 'Terlambat'
            : status === 'DUE_SOON'
              ? 'Segera jatuh tempo'
              : 'Terbuka',
    };
  });

  const withoutRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS "total"
      FROM employees e
     WHERE e.status IN ('RESIGNED','RETIRED')
       AND NOT EXISTS (
         SELECT 1 FROM post_employment_obligations o WHERE o.employee_id = e.id
       )
  `)) as unknown as { rows: any[] };

  const done = obligations.filter((o) => o.isCompleted).length;
  return {
    obligations,
    summary: {
      total: obligations.length,
      done,
      overdue: obligations.filter((o) => o.status === 'OVERDUE').length,
      dueSoon: obligations.filter((o) => o.status === 'DUE_SOON').length,
      completionPercentage:
        obligations.length > 0 ? Math.round((done / obligations.length) * 1000) / 10 : 0,
      employeesWithoutObligations: num(withoutRes.rows[0]?.total),
    },
  };
}

/**
 * Buat paket kewajiban standar untuk satu karyawan keluar. Idempoten lewat
 * UNIQUE(employee_id, obligation_code) sehingga aman dipanggil berulang.
 */
export async function generateObligations(
  db: Db,
  employeeId: string,
  referenceDate?: string
) {
  if (!employeeId) throw new BusinessRuleError('Karyawan wajib dipilih.');

  const emp = (await db.execute(sql`
    SELECT e.id, COALESCE(e.last_working_day, CURRENT_DATE) AS "lastDay"
      FROM employees e WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: any[] };
  const e = emp.rows[0];
  if (!e) throw new NotFoundError('Karyawan tidak ditemukan.');

  const base = referenceDate || toIsoDate(e.lastDay);
  let created = 0;
  for (const item of DEFAULT_OBLIGATIONS) {
    const due = new Date(`${base}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + item.dueOffsetDays);
    const res = (await db.execute(sql`
      INSERT INTO post_employment_obligations
        (employee_id, obligation_code, title, due_date)
      VALUES (${employeeId}::uuid, ${item.code}, ${OBLIGATION_LABEL[item.code]},
              ${due.toISOString().slice(0, 10)}::date)
      ON CONFLICT (employee_id, obligation_code) DO NOTHING
      RETURNING id
    `)) as unknown as { rows: any[] };
    if (res.rows[0]) created += 1;
  }
  return { employeeId, created, total: DEFAULT_OBLIGATIONS.length };
}

export async function setObligationCompleted(
  db: Db,
  input: {
    obligationId: string;
    isCompleted: boolean;
    referenceNo?: string | null;
    notes?: string | null;
    completedBy?: string | null;
  }
) {
  const res = (await db.execute(sql`
    UPDATE post_employment_obligations
       SET is_completed = ${input.isCompleted},
           completed_at = ${input.isCompleted ? sql`CURRENT_TIMESTAMP` : sql`NULL`},
           completed_by = ${input.isCompleted ? (input.completedBy ?? null) : null}::uuid,
           reference_no = COALESCE(${input.referenceNo ?? null}, reference_no),
           notes = COALESCE(${input.notes ?? null}, notes)
     WHERE id = ${input.obligationId}::uuid
    RETURNING id, is_completed AS "isCompleted", completed_at AS "completedAt"
  `)) as unknown as { rows: any[] };
  const row = res.rows[0];
  if (!row) throw new NotFoundError('Kewajiban tidak ditemukan.');
  return {
    id: row.id,
    isCompleted: !!row.isCompleted,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
  };
}

// ============================================================
// 5. ALUMNI & REKRUT ULANG
// ============================================================

export interface AlumniRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  exitDate: string;
  exitReason: string | null;
  lastPosition: string | null;
  lastDepartment: string | null;
  performanceRating: string | null;
  isRegrettable: boolean;
  rehireEligible: boolean;
  rehireReason: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  consentToContact: boolean;
  notes: string | null;
}

export interface AlumniOverview {
  alumni: AlumniRow[];
  summary: {
    total: number;
    rehireEligible: number;
    regrettable: number;
    consenting: number;
    eligiblePercentage: number;
  };
}

export async function getAlumniOverview(db: Db): Promise<AlumniOverview> {
  const res = (await db.execute(sql`
    SELECT a.id, a.employee_id AS "employeeId", e.full_name AS "employeeName",
           e.employee_code AS "employeeCode", a.exit_date AS "exitDate",
           a.exit_reason AS "exitReason", a.last_position AS "lastPosition",
           a.last_department AS "lastDepartment",
           a.performance_rating AS "performanceRating",
           a.is_regrettable AS "isRegrettable", a.rehire_eligible AS "rehireEligible",
           a.rehire_reason AS "rehireReason", a.contact_email AS "contactEmail",
           a.contact_phone AS "contactPhone",
           a.consent_to_contact AS "consentToContact", a.notes
      FROM alumni_records a
      JOIN employees e ON e.id = a.employee_id
     ORDER BY a.exit_date DESC
     LIMIT 500
  `)) as unknown as { rows: any[] };

  const alumni: AlumniRow[] = res.rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    exitDate: toIsoDate(r.exitDate),
    exitReason: r.exitReason ?? null,
    lastPosition: r.lastPosition ?? null,
    lastDepartment: r.lastDepartment ?? null,
    performanceRating: r.performanceRating ?? null,
    isRegrettable: !!r.isRegrettable,
    rehireEligible: !!r.rehireEligible,
    rehireReason: r.rehireReason ?? null,
    contactEmail: r.contactEmail ?? null,
    contactPhone: r.contactPhone ?? null,
    consentToContact: !!r.consentToContact,
    notes: r.notes ?? null,
  }));

  const eligible = alumni.filter((a) => a.rehireEligible).length;
  return {
    alumni,
    summary: {
      total: alumni.length,
      rehireEligible: eligible,
      regrettable: alumni.filter((a) => a.isRegrettable).length,
      consenting: alumni.filter((a) => a.consentToContact).length,
      eligiblePercentage: alumni.length > 0 ? Math.round((eligible / alumni.length) * 1000) / 10 : 0,
    },
  };
}

/**
 * Daftarkan karyawan yang sudah keluar ke direktori alumni. Data jabatan,
 * departemen, dan alasan keluar diambil otomatis dari profil & offboarding.
 */
export async function addAlumni(db: Db, employeeId: string) {
  if (!employeeId) throw new BusinessRuleError('Karyawan wajib dipilih.');
  const emp = (await db.execute(sql`
    SELECT e.id, e.email, e.phone_number AS "phone", e.full_name,
           jp.position_title AS "positionTitle", d.department_name AS "departmentName",
           COALESCE(e.last_working_day,
                    (SELECT o.last_working_day FROM offboarding_requests o
                      WHERE o.employee_id = e.id ORDER BY o.created_at DESC LIMIT 1),
                    CURRENT_DATE) AS "exitDate",
           (SELECT o.reason_for_leaving FROM offboarding_requests o
             WHERE o.employee_id = e.id ORDER BY o.created_at DESC LIMIT 1) AS "exitReason",
           (SELECT o.is_regrettable_attrition FROM offboarding_requests o
             WHERE o.employee_id = e.id ORDER BY o.created_at DESC LIMIT 1) AS "regrettable"
      FROM employees e
      JOIN job_positions jp ON jp.id = e.position_id
      JOIN departments d ON d.id = e.department_id
     WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: any[] };
  const e = emp.rows[0];
  if (!e) throw new NotFoundError('Karyawan tidak ditemukan.');

  const rating = (await db.execute(sql`
    SELECT performance_rating FROM performance_appraisals
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: any[] };

  const res = (await db.execute(sql`
    INSERT INTO alumni_records
      (employee_id, exit_date, exit_reason, last_position, last_department,
       performance_rating, is_regrettable, contact_email, contact_phone)
    VALUES (${employeeId}::uuid, ${toIsoDate(e.exitDate)}::date, ${e.exitReason ?? null},
            ${e.positionTitle}, ${e.departmentName}, ${rating.rows[0]?.performance_rating ?? null},
            ${!!e.regrettable}, ${e.email}, ${e.phone ?? null})
    ON CONFLICT (employee_id) DO UPDATE
      SET exit_date = EXCLUDED.exit_date,
          exit_reason = COALESCE(EXCLUDED.exit_reason, alumni_records.exit_reason),
          last_position = EXCLUDED.last_position,
          last_department = EXCLUDED.last_department,
          performance_rating = COALESCE(EXCLUDED.performance_rating, alumni_records.performance_rating),
          updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `)) as unknown as { rows: any[] };
  return { id: res.rows[0].id, employeeId, employeeName: e.full_name };
}

export async function updateAlumni(
  db: Db,
  input: {
    id: string;
    rehireEligible?: boolean;
    rehireReason?: string | null;
    consentToContact?: boolean;
    contactEmail?: string | null;
    contactPhone?: string | null;
    notes?: string | null;
  }
) {
  const res = (await db.execute(sql`
    UPDATE alumni_records
       SET rehire_eligible = COALESCE(${input.rehireEligible ?? null}::boolean, rehire_eligible),
           rehire_reason = COALESCE(${input.rehireReason ?? null}, rehire_reason),
           consent_to_contact = COALESCE(${input.consentToContact ?? null}::boolean, consent_to_contact),
           contact_email = COALESCE(${input.contactEmail ?? null}, contact_email),
           contact_phone = COALESCE(${input.contactPhone ?? null}, contact_phone),
           notes = COALESCE(${input.notes ?? null}, notes),
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${input.id}::uuid
    RETURNING id, rehire_eligible AS "rehireEligible",
              consent_to_contact AS "consentToContact"
  `)) as unknown as { rows: any[] };
  const row = res.rows[0];
  if (!row) throw new NotFoundError('Data alumni tidak ditemukan.');
  return {
    id: row.id,
    rehireEligible: !!row.rehireEligible,
    consentToContact: !!row.consentToContact,
  };
}

// ============================================================
// 6. ANALITIK ATRISI & BIAYA KELUAR
// ============================================================

export interface ExitReasonBucket {
  reason: string;
  total: number;
  percentage: number;
}

export interface ExitAnalytics {
  totalExits: number;
  exitsLast12Months: number;
  regrettableExits: number;
  regrettablePercentage: number;
  averageTenureMonths: number;
  averageExitRating: number | null;
  exitReasons: ExitReasonBucket[];
  byDepartment: Array<{ department: string; total: number }>;
  monthlyTrend: Array<{ period: string; total: number }>;
  costByReason: Array<{ reason: string; totalCost: number; cases: number }>;
  totalExitCost: number;
  averageExitCost: number;
  potentialMonthlySaving: number;
}

const EXIT_REASON_LABEL: Record<string, string> = {
  RESIGNATION: 'Mengundurkan diri',
  CONTRACT_END: 'Kontrak berakhir',
  RETIREMENT: 'Pensiun',
  TERMINATION: 'Pemutusan hubungan kerja',
  DISMISSAL: 'Pemberhentian',
  ABSCONDING: 'Meninggalkan pekerjaan',
  COMPANY_INITIATED: 'Inisiatif perusahaan',
  OTHER: 'Lainnya',
};

export function exitReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'Tidak dicatat';
  return EXIT_REASON_LABEL[reason.toUpperCase()] ?? reason;
}

/**
 * Ringkasan atrisi & biaya keluar. Biaya dihitung dari `severance_calculations`
 * yang sudah tersimpan, bukan estimasi, agar angkanya dapat diaudit.
 */
export async function getExitAnalytics(db: Db): Promise<ExitAnalytics> {
  const exits = (await db.execute(sql`
    SELECT o.reason_for_leaving AS "reason",
           o.last_working_day AS "lastDay",
           o.is_regrettable_attrition AS "regrettable",
           d.department_name AS "departmentName",
           (o.last_working_day - e.join_date)::float / 30.4375 AS "tenureMonths",
           sc.total_disbursement AS "cost"
      FROM offboarding_requests o
      JOIN employees e ON e.id = o.employee_id
      JOIN departments d ON d.id = e.department_id
      LEFT JOIN severance_calculations sc ON sc.offboarding_request_id = o.id
     ORDER BY o.last_working_day DESC
  `)) as unknown as { rows: any[] };

  const rows = exits.rows;
  const today = todayIso();
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);

  const reasonMap = new Map<string, number>();
  const deptMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  const costMap = new Map<string, { totalCost: number; cases: number }>();

  let regret = 0;
  let tenureSum = 0;
  let tenureCount = 0;
  let totalCost = 0;
  let last12 = 0;

  for (const r of rows) {
    const reasonKey = exitReasonLabel(r.reason);
    reasonMap.set(reasonKey, (reasonMap.get(reasonKey) ?? 0) + 1);
    deptMap.set(r.departmentName, (deptMap.get(r.departmentName) ?? 0) + 1);

    const lastDay = toIsoDate(r.lastDay);
    if (lastDay) {
      const month = lastDay.slice(0, 7);
      monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
      if (Date.parse(`${lastDay}T00:00:00Z`) >= cutoff.getTime()) last12 += 1;
    }
    if (r.regrettable) regret += 1;
    if (r.tenureMonths != null) {
      tenureSum += num(r.tenureMonths);
      tenureCount += 1;
    }
    const cost = num(r.cost);
    if (cost > 0) {
      totalCost += cost;
      const prev = costMap.get(reasonKey) ?? { totalCost: 0, cases: 0 };
      costMap.set(reasonKey, { totalCost: prev.totalCost + cost, cases: prev.cases + 1 });
    }
  }

  const ratingRes = (await db.execute(sql`
    SELECT AVG(overall_rating)::float AS "avg" FROM exit_interviews
  `)) as unknown as { rows: any[] };
  const avgRating = ratingRes.rows[0]?.avg;

  const total = rows.length;
  const exitReasons: ExitReasonBucket[] = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({
      reason,
      total: count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const monthlyTrend = Array.from(monthMap.entries())
    .map(([period, count]) => ({ period, total: count }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-12);

  return {
    totalExits: total,
    exitsLast12Months: last12,
    regrettableExits: regret,
    regrettablePercentage: total > 0 ? Math.round((regret / total) * 1000) / 10 : 0,
    averageTenureMonths: tenureCount > 0 ? Math.round((tenureSum / tenureCount) * 10) / 10 : 0,
    averageExitRating: avgRating != null ? Math.round(num(avgRating) * 10) / 10 : null,
    exitReasons,
    byDepartment: Array.from(deptMap.entries())
      .map(([department, count]) => ({ department, total: count }))
      .sort((a, b) => b.total - a.total),
    monthlyTrend,
    costByReason: Array.from(costMap.entries())
      .map(([reason, v]) => ({ reason, totalCost: v.totalCost, cases: v.cases }))
      .sort((a, b) => b.totalCost - a.totalCost),
    totalExitCost: totalCost,
    averageExitCost: total > 0 ? Math.round(totalCost / total) : 0,
    potentialMonthlySaving: Math.round(totalCost / 12),
  };
}
