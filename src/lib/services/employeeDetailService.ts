import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { can } from '@/lib/auth/rbac';
import { ForbiddenError, NotFoundError } from '@/lib/auth/errors';
import type { SessionPayload } from '@/lib/auth/session';

/** Peran yang boleh melihat seluruh pegawai. */
const PENGAWAS_PENUH = ['SUPER_ADMIN', 'BOD', 'HR_MANAGER'];

/** True bila `managerEmployeeId` adalah atasan langsung dari bawahan tsb. */
async function atasanLangsungDari(
  db: Db,
  managerEmployeeId: string,
  subordinateEmployeeId: string
): Promise<boolean> {
  if (!managerEmployeeId || !subordinateEmployeeId) return false;
  const res = (await db.execute(sql`
    SELECT 1 FROM employees
     WHERE id = ${subordinateEmployeeId}::uuid
       AND manager_id = ${managerEmployeeId}::uuid
     LIMIT 1
  `)) as unknown as { rows: unknown[] };
  return (res.rows?.length ?? 0) > 0;
}

/**
 * Aturan akses halaman detail pegawai.
 *
 * - SUPER_ADMIN / BOD / HR_MANAGER: semua pegawai.
 * - PEOPLE_MANAGER: bawahan langsung dan dirinya sendiri.
 * - EMPLOYEE: dirinya sendiri.
 */
export async function bolehLihatPegawai(
  db: Db,
  session: SessionPayload,
  targetEmployeeId: string
): Promise<boolean> {
  const saya = session.employeeId;
  if (!saya || !targetEmployeeId) return false;
  if (targetEmployeeId === saya) return true;
  if (PENGAWAS_PENUH.includes(session.role)) return true;
  if (session.role === 'PEOPLE_MANAGER') {
    return atasanLangsungDari(db, saya, targetEmployeeId);
  }
  return false;
}

/** Melempar ForbiddenError bila sesi tidak berhak melihat pegawai tsb. */
export async function assertBolehLihatPegawai(
  db: Db,
  session: SessionPayload,
  targetEmployeeId: string
): Promise<void> {
  if (!(await bolehLihatPegawai(db, session, targetEmployeeId))) {
    throw new ForbiddenError('Anda tidak berhak melihat data pegawai ini.');
  }
}

export interface ProfilDetail {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  departmentName: string | null;
  positionTitle: string | null;
  jobGrade: string | null;
  status: string | null;
  joinDate: string | null;
  masaKerja: string | null;
  managerName: string | null;
  directReportCount: number;
}

function hitungMasaKerja(joinDate: string | null): string | null {
  if (!joinDate) return null;
  const mulai = new Date(joinDate);
  if (Number.isNaN(mulai.getTime())) return null;
  const kini = new Date();
  let bulan = (kini.getFullYear() - mulai.getFullYear()) * 12 + (kini.getMonth() - mulai.getMonth());
  if (kini.getDate() < mulai.getDate()) bulan -= 1;
  if (bulan < 0) return null;
  const tahun = Math.floor(bulan / 12);
  const sisa = bulan % 12;
  if (tahun === 0) return `${sisa} bulan`;
  return sisa === 0 ? `${tahun} tahun` : `${tahun} tahun ${sisa} bulan`;
}

async function ambilProfil(db: Db, id: string): Promise<ProfilDetail | null> {
  const res = (await db.execute(sql`
    SELECT e.id::text AS id, e.employee_code AS "employeeCode", e.full_name AS "fullName",
           e.email AS email, e.phone_number AS phone,
           d.department_name AS "departmentName",
           p.position_title AS "positionTitle", p.job_grade AS "jobGrade",
           e.status::text AS status, e.join_date::text AS "joinDate",
           m.full_name AS "managerName",
           (SELECT count(*)::int FROM employees c
             WHERE c.manager_id = e.id AND c.status IN ('PROBATION','PERMANENT','CONTRACT')) AS "directReportCount"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN job_positions p ON p.id = e.position_id
      LEFT JOIN employees m ON m.id = e.manager_id
     WHERE e.id = ${id}::uuid
     LIMIT 1
  `)) as unknown as { rows: any[] };
  const r = res.rows?.[0];
  if (!r) return null;
  return {
    id: r.id,
    employeeCode: r.employeeCode ?? '-',
    fullName: r.fullName ?? '-',
    email: r.email ?? null,
    phone: r.phone ?? null,
    departmentName: r.departmentName ?? null,
    positionTitle: r.positionTitle ?? null,
    jobGrade: r.jobGrade ?? null,
    status: r.status ?? null,
    joinDate: r.joinDate ?? null,
    masaKerja: hitungMasaKerja(r.joinDate ?? null),
    managerName: r.managerName ?? null,
    directReportCount: Number(r.directReportCount ?? 0),
  };
}

/** Data seluruh pegawai untuk halaman detail. */
export async function getDetailPegawai(db: Db, session: SessionPayload, id: string) {
  await assertBolehLihatPegawai(db, session, id);

  const profil = await ambilProfil(db, id);
  if (!profil) throw new NotFoundError('Pegawai tidak ditemukan.');

  // KPI: daftar sasaran beserta capaian (achievement_percentage dihitung DB).
  const kpi = (await db.execute(sql`
    SELECT ik.id::text AS id, ik.kpi_title AS judul, ik.target_value AS target,
           ik.actual_value AS actual, ik.unit_of_measure AS satuan,
           ik.kpi_weight AS bobot, ik.achievement_percentage AS capaian,
           ik.status::text AS status, ap.period_code AS periode
      FROM individual_kpis ik
      LEFT JOIN appraisal_periods ap ON ap.id = ik.period_id
     WHERE ik.employee_id = ${id}::uuid
     ORDER BY ap.period_code DESC NULLS LAST, ik.kpi_title
  `)) as unknown as { rows: any[] };

  // Penggajian hanya untuk pemegang izin payroll:read.
  let penggajian: any = null;
  if (can(session.role, 'payroll:read')) {
    const gaji = (await db.execute(sql`
      SELECT base_salary AS "gajiPokok"
        FROM employees WHERE id = ${id}::uuid LIMIT 1
    `)) as unknown as { rows: any[] };
    const slip = (await db.execute(sql`
      SELECT pi.id::text AS id, pr.period_code AS periode,
             pi.gross AS bruto, pi.total_deductions AS potongan,
             pi.net AS bersih, pr.status::text AS status
        FROM payroll_items pi
        JOIN payroll_runs pr ON pr.id = pi.run_id
       WHERE pi.employee_id = ${id}::uuid
       ORDER BY pr.period_code DESC
       LIMIT 24
    `)) as unknown as { rows: any[] };
    penggajian = {
      gajiPokok: Number(gaji.rows?.[0]?.gajiPokok ?? 0),
      slip: (slip.rows ?? []).map((r) => ({
        id: r.id,
        periode: r.periode,
        bruto: Number(r.bruto ?? 0),
        potongan: Number(r.potongan ?? 0),
        bersih: Number(r.bersih ?? 0),
        status: r.status,
      })),
    };
  }

  const kehadiran = (await db.execute(sql`
    SELECT work_date::text AS tanggal, is_present AS hadir,
           total_work_hours::float8 AS jamKerja, total_overtime_hours::float8 AS jamLembur
      FROM attendance_records
     WHERE employee_id = ${id}::uuid
     ORDER BY work_date DESC
     LIMIT 30
  `)) as unknown as { rows: any[] };

  const bpjs = (await db.execute(sql`
    SELECT bpjs_tk_number AS "nomorTk", bpjs_kes_number AS "nomorKes",
           bpjs_kes_class AS "kelas", bpjs_tk_status AS "statusTk",
           bpjs_kes_status AS "statusKes", registered_at::text AS "terdaftar"
      FROM employee_social_security WHERE employee_id = ${id}::uuid
  `)) as unknown as { rows: any[] };

  // Indikator (KPI) harian: entri yang sudah disimpan karyawan.
  const indikatorHarian = (await db.execute(sql`
    SELECT e.id::text AS id, e.entry_date::text AS tanggal,
           ki.indicator_name AS indikator, ki.unit_of_measure AS satuan,
           ki.target_value::float8 AS target,
           e.actual_value::float8 AS aktual,
           e.status::text AS status
      FROM kpi_daily_entries e
      LEFT JOIN kpi_indicators ki ON ki.id = e.indicator_id
     WHERE e.employee_id = ${id}::uuid
     ORDER BY e.entry_date DESC
     LIMIT 60
  `)) as unknown as { rows: any[] };

  // Riwayat penilaian dari performance_appraisals.
  const riwayatPenilaian = (await db.execute(sql`
    SELECT ap.period_code AS periode, pa.composite_gpa::float8 AS gpa,
           pa.performance_rating::text AS rating, pa.total_percentage_score::float8 AS total
      FROM performance_appraisals pa
      LEFT JOIN appraisal_periods ap ON ap.id = pa.period_id
     WHERE pa.employee_id = ${id}::uuid
     ORDER BY ap.period_code DESC NULLS LAST
  `)) as unknown as { rows: any[] };

  // Berkas kepegawaian: dipakai untuk menandai dokumen yang belum lengkap.
  const dokumen = (await db.execute(sql`
    SELECT document_type AS "documentType", verification_status AS "verificationStatus",
           expiry_date::text AS "expiryDate"
      FROM employee_documents
     WHERE employee_id = ${id}::uuid
     ORDER BY document_type
  `)) as unknown as { rows: any[] };

  // Kontribusi per pilar BSC — dipindah dari modal "Lihat kontribusi".
  let kontribusi: any = null;
  try {
    const { getEmployeeBscContribution } = await import('./employeeBscContributionService');
    kontribusi = await getEmployeeBscContribution(db, id);
  } catch {
    // Bila belum ada KPI, biarkan null agar halaman tetap tampil.
    kontribusi = null;
  }

  return {
    profil,
    kontribusi,
    kpi: (kpi.rows ?? []).map((r) => ({
      id: r.id,
      judul: r.judul,
      target: Number(r.target ?? 0),
      actual: Number(r.actual ?? 0),
      satuan: r.satuan ?? '%',
      bobot: Number(r.bobot ?? 0),
      capaian: Number(r.capaian ?? 0),
      status: r.status,
      periode: r.periode ?? '-',
    })),
    // Kunci `penggajian` HANYA ada bila sesi berhak — jangan kirim null,
    // karena itu tetap membocorkan bahwa data gaji ada.
    ...(penggajian ? { penggajian } : {}),
    kehadiran: (kehadiran.rows ?? []).map((r) => ({
      tanggal: r.tanggal,
      hadir: Boolean(r.hadir),
      jamKerja: Number(r.jamKerja ?? 0),
      jamLembur: Number(r.jamLembur ?? 0),
    })),
    bpjs: (bpjs.rows ?? []).map((r) => ({
      nomorTk: r.nomorTk ?? null,
      nomorKes: r.nomorKes ?? null,
      kelas: r.kelas ?? null,
      statusTk: r.statusTk ?? null,
      statusKes: r.statusKes ?? null,
      terdaftar: r.terdaftar ?? null,
    })),
    indikatorHarian: (indikatorHarian.rows ?? []).map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      indikator: r.indikator ?? '-',
      satuan: r.satuan ?? '%',
      target: Number(r.target ?? 0),
      aktual: Number(r.aktual ?? 0),
      status: r.status ?? '-',
    })),
    riwayatPenilaian: (riwayatPenilaian.rows ?? []).map((r) => ({
      periode: r.periode ?? '-',
      gpa: Number(r.gpa ?? 0),
      rating: r.rating ?? '-',
      total: Number(r.total ?? 0),
    })),
    dokumen: (dokumen.rows ?? []).map((r) => ({
      documentType: r.documentType ?? '-',
      verificationStatus: r.verificationStatus ?? 'PENDING',
      expiryDate: r.expiryDate ?? null,
    })),
  };
}
