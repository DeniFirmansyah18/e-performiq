/**
 * Seed data talenta & kontrak yang membuat panel HR Command Center bermakna:
 * "Rekomendasi Aksi & Karir" dan "Direktori Pegawai & Status PKWT".
 *
 * Tanpa data ini kedua panel berfungsi secara kode tetapi selalu kosong:
 *  - tidak ada pegawai berstatus PKWT sehingga ringkasan kontrak selalu 0;
 *  - hanya 2 jenjang karir dan 2 baris kompetensi (keduanya milik 1 orang)
 *    sehingga panduan karir tidak pernah muncul untuk pegawai lain;
 *  - nama skill pada `competency_scores` tidak beririsan dengan
 *    `career_path_levels.required_skills` sehingga seluruh skill wajib
 *    selamanya berstatus "belum diasesmen".
 *
 * Idempoten: seluruh baris memakai id tetap + `ON CONFLICT DO NOTHING`, dan
 * pembaruan memakai `WHERE` yang membuat eksekusi ulang tidak mengubah data.
 */
import type { SqlClient } from '@/lib/db/client';

/** Titik acuan tanggal kontrak. Dibuat relatif agar panel tetap relevan. */
const CONTRACT_REFERENCE_DATE = new Date('2026-10-31T00:00:00Z');

function shiftDays(days: number): string {
  const d = new Date(CONTRACT_REFERENCE_DATE.getTime() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Ubah tanggal `YYYY-MM-DD` menjadi timestamp UTC agar jam transisi eksplisit. */
function ts(date: string): string {
  return `${q(`${date}T01:00:00Z`)}::timestamptz`;
}

/** HR Manager pemutus transisi fase pada data seed. */
const PKWT_DECIDER = 'e0000000-0000-4000-8000-000000000002';

interface PkwtSeedRow {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  departmentId: string;
  positionId: string;
  managerId: string | null;
  baseSalary: number;
  joinDate: string;
  /** Sisa hari menuju akhir kontrak pada `CONTRACT_REFERENCE_DATE`. */
  daysRemaining: number | null;
  /** Panjang kontrak (bulan) untuk menghitung tanggal mulai. */
  termMonths: number;
}

/**
 * Lima pegawai PKWT yang sengaja disebar ke seluruh tingkat urgensi agar setiap
 * filter dan kartu ringkasan pada panel kontrak dapat diuji:
 * kedaluwarsa, kritis <30 hari, peringatan <60 hari, aman, dan tanpa tanggal
 * akhir kontrak.
 */
const PKWT_EMPLOYEES: PkwtSeedRow[] = [
  {
    id: 'c0000000-0000-4000-8000-000000000101',
    employeeCode: 'PKWT-2024-0301',
    fullName: 'Yusuf Ramadhan, S.Kom.',
    email: 'yusuf.ramadhan@eperformiq.co.id',
    departmentId: 'a0000000-0000-4000-8000-000000000101',
    positionId: 'a0000000-0000-4000-8000-000000000204',
    managerId: 'b0000000-0000-4000-8000-000000000003',
    baseSalary: 15000000,
    joinDate: '2024-11-01',
    daysRemaining: -12,
    termMonths: 12,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000102',
    employeeCode: 'PKWT-2025-0302',
    fullName: 'Maya Anggraini, S.Ds.',
    email: 'maya.anggraini@eperformiq.co.id',
    departmentId: 'a0000000-0000-4000-8000-000000000101',
    positionId: 'a0000000-0000-4000-8000-000000000204',
    managerId: 'b0000000-0000-4000-8000-000000000003',
    baseSalary: 14000000,
    joinDate: '2025-02-01',
    daysRemaining: 18,
    termMonths: 12,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000103',
    employeeCode: 'PKWT-2025-0303',
    fullName: 'Fajar Nugroho, S.Ak.',
    email: 'fajar.nugroho@eperformiq.co.id',
    departmentId: 'a0000000-0000-4000-8000-000000000104',
    positionId: 'a0000000-0000-4000-8000-000000000205',
    managerId: 'b0000000-0000-4000-8000-000000000005',
    baseSalary: 16000000,
    joinDate: '2025-01-15',
    daysRemaining: 47,
    termMonths: 12,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000104',
    employeeCode: 'PKWT-2025-0304',
    fullName: 'Lestari Puspita, S.Psi.',
    email: 'lestari.puspita@eperformiq.co.id',
    departmentId: 'a0000000-0000-4000-8000-000000000102',
    positionId: 'a0000000-0000-4000-8000-000000000206',
    managerId: 'b0000000-0000-4000-8000-000000000002',
    baseSalary: 13500000,
    joinDate: '2025-05-01',
    daysRemaining: 145,
    termMonths: 12,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000105',
    employeeCode: 'PKWT-2025-0305',
    fullName: 'Gilang Saputra, S.Kom.',
    email: 'gilang.saputra@eperformiq.co.id',
    departmentId: 'a0000000-0000-4000-8000-000000000101',
    positionId: 'a0000000-0000-4000-8000-000000000204',
    managerId: 'b0000000-0000-4000-8000-000000000003',
    baseSalary: 13000000,
    joinDate: '2025-03-01',
    daysRemaining: null,
    termMonths: 12,
  },
];

interface CareerPathSeedRow {
  id: string;
  fromPositionId: string;
  targetPositionId: string;
  minGpa: number;
  minServiceMonths: number;
  requiredSkills: string[];
}

/**
 * Jenjang karir untuk SETIAP posisi yang benar-benar terisi. Urutan posisi
 * mengikuti tangga jabatan pada `job_positions` sehingga setiap pegawai aktif
 * memiliki tujuan promosi berikutnya.
 */
const CAREER_PATHS: CareerPathSeedRow[] = [
  {
    id: '82000000-0000-4000-8000-000000000001',
    fromPositionId: 'a0000000-0000-4000-8000-000000000204',
    targetPositionId: 'a0000000-0000-4000-8000-000000000203',
    minGpa: 3.25,
    minServiceMonths: 24,
    requiredSkills: ['TypeScript', 'PostgreSQL', 'System Design'],
  },
  {
    id: '82000000-0000-4000-8000-000000000002',
    fromPositionId: 'a0000000-0000-4000-8000-000000000203',
    targetPositionId: 'a0000000-0000-4000-8000-000000000202',
    minGpa: 3.5,
    minServiceMonths: 36,
    requiredSkills: ['Leadership', 'Strategic Planning', 'Budgeting'],
  },
  {
    id: '82000000-0000-4000-8000-000000000003',
    fromPositionId: 'a0000000-0000-4000-8000-000000000202',
    targetPositionId: 'a0000000-0000-4000-8000-000000000201',
    minGpa: 3.5,
    minServiceMonths: 48,
    requiredSkills: ['Strategic Planning', 'Business Acumen', 'Stakeholder Management'],
  },
  {
    id: '82000000-0000-4000-8000-000000000004',
    fromPositionId: 'a0000000-0000-4000-8000-000000000205',
    targetPositionId: 'a0000000-0000-4000-8000-000000000201',
    minGpa: 3.6,
    minServiceMonths: 60,
    requiredSkills: ['Audit Methodology', 'Risk Governance', 'Stakeholder Management'],
  },
  {
    id: '82000000-0000-4000-8000-000000000005',
    fromPositionId: 'a0000000-0000-4000-8000-000000000206',
    targetPositionId: 'a0000000-0000-4000-8000-000000000202',
    minGpa: 3.25,
    minServiceMonths: 24,
    requiredSkills: ['HR Administration', 'HRIS Management', 'Compensation & Benefit'],
  },
  {
    id: '82000000-0000-4000-8000-000000000006',
    fromPositionId: 'a0000000-0000-4000-8000-000000000207',
    targetPositionId: 'a0000000-0000-4000-8000-000000000202',
    minGpa: 3.4,
    minServiceMonths: 36,
    requiredSkills: ['Assessment Methodology', 'Talent Management', 'Psychometrics'],
  },
];

interface CompetencySeedRow {
  id: string;
  employeeId: string;
  skillName: string;
  skillCategory: 'HARD' | 'SOFT';
  requiredLevel: number;
  actualLevel: number;
  score: number;
}

/**
 * Skor kompetensi untuk tiap pegawai pada skill yang benar-benar disyaratkan
 * jenjang karirnya. Sengaja bervariasi — sebagian terpenuhi, sebagian kurang,
 * sebagian belum dinilai — agar kolom gap skill pada panduan karir terisi
 * ketiga statusnya.
 */
const COMPETENCIES: CompetencySeedRow[] = [
  // Budi (Senior SWE -> Head of Engineering): semua skill terpenuhi.
  { id: '20000000-0000-4000-8000-000000000101', employeeId: 'b0000000-0000-4000-8000-000000000004', skillName: 'TypeScript', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 5, score: 92.5 },
  { id: '20000000-0000-4000-8000-000000000102', employeeId: 'b0000000-0000-4000-8000-000000000004', skillName: 'PostgreSQL', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 4, score: 88.0 },
  { id: '20000000-0000-4000-8000-000000000103', employeeId: 'b0000000-0000-4000-8000-000000000004', skillName: 'System Design', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 4, score: 86.5 },

  // Dimas (Senior SWE): System Design masih di bawah syarat.
  { id: '20000000-0000-4000-8000-000000000104', employeeId: 'b0000000-0000-4000-8000-000000000008', skillName: 'TypeScript', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 4, score: 85.0 },
  { id: '20000000-0000-4000-8000-000000000105', employeeId: 'b0000000-0000-4000-8000-000000000008', skillName: 'PostgreSQL', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 4, score: 84.0 },
  { id: '20000000-0000-4000-8000-000000000106', employeeId: 'b0000000-0000-4000-8000-000000000008', skillName: 'System Design', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 3, score: 72.0 },

  // Anisa (Senior SWE): baru TypeScript yang dinilai, sisanya belum.
  { id: '20000000-0000-4000-8000-000000000107', employeeId: 'b0000000-0000-4000-8000-000000000007', skillName: 'TypeScript', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 4, score: 83.5 },

  // Rian (Senior SWE, masa probation): belum ada asesmen kompetensi.

  // Danu (Head of Engineering -> VP of HC).
  { id: '20000000-0000-4000-8000-000000000108', employeeId: 'b0000000-0000-4000-8000-000000000003', skillName: 'Leadership', skillCategory: 'SOFT', requiredLevel: 4, actualLevel: 5, score: 91.0 },
  { id: '20000000-0000-4000-8000-000000000109', employeeId: 'b0000000-0000-4000-8000-000000000003', skillName: 'Strategic Planning', skillCategory: 'SOFT', requiredLevel: 4, actualLevel: 4, score: 87.0 },
  { id: '20000000-0000-4000-8000-000000000110', employeeId: 'b0000000-0000-4000-8000-000000000003', skillName: 'Budgeting', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 3, score: 74.5 },

  // Siti (VP of HC -> CEO).
  { id: '20000000-0000-4000-8000-000000000111', employeeId: 'b0000000-0000-4000-8000-000000000002', skillName: 'Strategic Planning', skillCategory: 'SOFT', requiredLevel: 5, actualLevel: 5, score: 93.0 },
  { id: '20000000-0000-4000-8000-000000000112', employeeId: 'b0000000-0000-4000-8000-000000000002', skillName: 'Business Acumen', skillCategory: 'SOFT', requiredLevel: 5, actualLevel: 4, score: 82.0 },
  { id: '20000000-0000-4000-8000-000000000113', employeeId: 'b0000000-0000-4000-8000-000000000002', skillName: 'Stakeholder Management', skillCategory: 'SOFT', requiredLevel: 5, actualLevel: 5, score: 90.0 },

  // Bambang (Chief Internal Auditor -> CEO).
  { id: '20000000-0000-4000-8000-000000000114', employeeId: 'b0000000-0000-4000-8000-000000000005', skillName: 'Audit Methodology', skillCategory: 'HARD', requiredLevel: 5, actualLevel: 5, score: 95.0 },
  { id: '20000000-0000-4000-8000-000000000115', employeeId: 'b0000000-0000-4000-8000-000000000005', skillName: 'Risk Governance', skillCategory: 'HARD', requiredLevel: 5, actualLevel: 4, score: 84.0 },

  // Rina (HR System Administrator -> VP of HC).
  { id: '20000000-0000-4000-8000-000000000116', employeeId: 'b0000000-0000-4000-8000-000000000006', skillName: 'HR Administration', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 5, score: 91.5 },
  { id: '20000000-0000-4000-8000-000000000117', employeeId: 'b0000000-0000-4000-8000-000000000006', skillName: 'HRIS Management', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 4, score: 88.0 },
  { id: '20000000-0000-4000-8000-000000000118', employeeId: 'b0000000-0000-4000-8000-000000000006', skillName: 'Compensation & Benefit', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 4, score: 85.5 },

  // Aris (Lead Talent Assessor -> VP of HC).
  { id: '20000000-0000-4000-8000-000000000119', employeeId: 'b0000000-0000-4000-8000-000000000011', skillName: 'Assessment Methodology', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 5, score: 94.0 },
  { id: '20000000-0000-4000-8000-000000000120', employeeId: 'b0000000-0000-4000-8000-000000000011', skillName: 'Talent Management', skillCategory: 'SOFT', requiredLevel: 4, actualLevel: 4, score: 87.5 },
  { id: '20000000-0000-4000-8000-000000000121', employeeId: 'b0000000-0000-4000-8000-000000000011', skillName: 'Psychometrics', skillCategory: 'HARD', requiredLevel: 4, actualLevel: 4, score: 89.0 },
];

interface AppraisalSeedRow {
  id: string;
  employeeId: string;
  compositeGpa: number;
  performanceRating: string;
  potentialScore: number;
  nineBox: string;
  totalPercentage: number;
}

/**
 * Appraisal pendukung. Tanpa GPA, syarat promosi mustahil terpenuhi sehingga
 * rekomendasi promosi tidak akan pernah muncul untuk pegawai ini.
 */
const APPRAISALS: AppraisalSeedRow[] = [
  { id: '40000000-0000-4000-8000-000000000101', employeeId: 'b0000000-0000-4000-8000-000000000003', compositeGpa: 3.58, performanceRating: 'A', potentialScore: 4.10, nineBox: 'FUTURE_LEADER', totalPercentage: 90.20 },
  { id: '40000000-0000-4000-8000-000000000102', employeeId: 'b0000000-0000-4000-8000-000000000002', compositeGpa: 3.72, performanceRating: 'A', potentialScore: 4.40, nineBox: 'HIGH_IMPACT', totalPercentage: 93.10 },
  { id: '40000000-0000-4000-8000-000000000103', employeeId: 'b0000000-0000-4000-8000-000000000005', compositeGpa: 3.65, performanceRating: 'A', potentialScore: 3.90, nineBox: 'HIGH_IMPACT', totalPercentage: 91.40 },
  { id: '40000000-0000-4000-8000-000000000104', employeeId: 'b0000000-0000-4000-8000-000000000006', compositeGpa: 3.40, performanceRating: 'B', potentialScore: 3.60, nineBox: 'HIGH_IMPACT', totalPercentage: 85.60 },
  { id: '40000000-0000-4000-8000-000000000105', employeeId: 'b0000000-0000-4000-8000-000000000008', compositeGpa: 3.30, performanceRating: 'B', potentialScore: 3.50, nineBox: 'CORE_PLAYER', totalPercentage: 84.10 },
  { id: '40000000-0000-4000-8000-000000000106', employeeId: 'b0000000-0000-4000-8000-000000000007', compositeGpa: 3.28, performanceRating: 'B', potentialScore: 3.45, nineBox: 'CORE_PLAYER', totalPercentage: 83.20 },
  { id: '40000000-0000-4000-8000-000000000107', employeeId: 'b0000000-0000-4000-8000-000000000011', compositeGpa: 3.55, performanceRating: 'A', potentialScore: 4.00, nineBox: 'FUTURE_LEADER', totalPercentage: 89.30 },
];

function q(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonArray(values: string[]): string {
  return `${q(JSON.stringify(values))}::jsonb`;
}

export async function seedTalentAndContracts(client: SqlClient): Promise<void> {
  // 1) Pegawai PKWT pada seluruh tingkat urgensi kontrak.
  const pkwtPhaseRows: string[] = [];
  for (const row of PKWT_EMPLOYEES) {
    const endDate = row.daysRemaining === null ? null : shiftDays(row.daysRemaining);
    const startDate =
      row.daysRemaining === null
        ? shiftDays(-row.termMonths * 30)
        : shiftDays(row.daysRemaining - row.termMonths * 30);

    await client.exec(`
INSERT INTO employees (id, employee_code, full_name, email, phone_number,
                       department_id, position_id, manager_id, status,
                       employment_status, contract_start_date, contract_end_date,
                       base_salary, join_date) VALUES
  (${q(row.id)},${q(row.employeeCode)},${q(row.fullName)},${q(row.email)},'',
   ${q(row.departmentId)},${q(row.positionId)},${q(row.managerId)},
   'CONTRACT'::employee_status_enum,'PKWT'::employment_status_enum,
   ${endDate ? `${q(startDate)}::date` : 'NULL'},${endDate ? `${q(endDate)}::date` : 'NULL'},
   ${row.baseSalary},${q(row.joinDate)})
ON CONFLICT (id) DO NOTHING;
`);

    // Pegawai PKWT sudah melewati rekrutmen dan sedang aktif bekerja, sehingga
    // fasenya DURING dengan satu transisi awal pada tanggal bergabung.
    pkwtPhaseRows.push(
      `('6f000000-0000-4000-8000-${row.id.slice(-12)}',${q(row.id)},NULL,'DURING'::employee_phase_enum,${q(row.joinDate)}::date,'Karyawan PKWT aktif sejak tanggal bergabung.',${q(PKWT_DECIDER)},${ts(row.joinDate)})`
    );
  }

  // 2) Riwayat transisi fase untuk pegawai PKWT agar kolom denormalisasi
  // `employees.employee_phase` punya jejak audit yang bisa ditelusuri.
  if (pkwtPhaseRows.length > 0) {
    await client.exec(`
INSERT INTO employee_phase_history
  (id, employee_id, previous_phase, new_phase, effective_date, reason, decided_by, created_at) VALUES
  ${pkwtPhaseRows.join(',\n  ')}
ON CONFLICT (id) DO NOTHING;
`);
  }

  // 3) Jenjang karir untuk setiap posisi yang terisi.
  for (const path of CAREER_PATHS) {
    await client.exec(`
INSERT INTO career_path_levels (id, job_position_id, target_position_id, min_gpa, min_service_months, required_skills) VALUES
  (${q(path.id)},${q(path.fromPositionId)},${q(path.targetPositionId)},${path.minGpa},${path.minServiceMonths},${jsonArray(path.requiredSkills)})
ON CONFLICT (id) DO NOTHING;
`);
  }

  // 4) Skor kompetensi pada skill yang benar-benar disyaratkan.
  for (const c of COMPETENCIES) {
    await client.exec(`
INSERT INTO competency_scores (id, period_id, employee_id, skill_name, skill_category, required_level, actual_level, score) VALUES
  (${q(c.id)},'d0000000-0000-4000-8000-000000000001'::uuid,${q(c.employeeId)},${q(c.skillName)},${q(c.skillCategory)},${c.requiredLevel},${c.actualLevel},${c.score})
ON CONFLICT (id) DO NOTHING;
`);
  }

  // 5) Appraisal pendukung syarat GPA.
  for (const a of APPRAISALS) {
    await client.exec(`
INSERT INTO performance_appraisals (id, period_id, employee_id, kpi_composite_score, sop_compliance_score, competency_score, core_values_score, total_percentage_score, composite_gpa, performance_rating, potential_score, nine_box_quadrant, is_calibrated, calibration_notes) VALUES
  (${q(a.id)},'d0000000-0000-4000-8000-000000000001'::uuid,${q(a.employeeId)},${a.totalPercentage},${a.totalPercentage},${a.totalPercentage},${a.totalPercentage},${a.totalPercentage},${a.compositeGpa},${q(a.performanceRating)},${a.potentialScore},${q(a.nineBox)}::nine_box_quadrant_enum,FALSE,'Seed data talenta untuk panel rekomendasi karir')
ON CONFLICT (id) DO NOTHING;
`);
  }

  // 6) Selaraskan kolom denormalisasi dengan transisi terakhir di riwayat fase.
  // Seeder ini berjalan setelah `seedLifecycle`, yang sudah lebih dulu
  // menyelaraskan kolomnya, sehingga tanpa langkah ini pegawai PKWT tetap
  // berfase NULL. Satu statement: PGlite hanya menerapkan efek pertama pada
  // batch multi-statement.
  await client.exec(`UPDATE employees e
    SET employee_phase = latest.new_phase
    FROM (
      SELECT DISTINCT ON (h.employee_id) h.employee_id, h.new_phase
        FROM employee_phase_history h
       ORDER BY h.employee_id, h.effective_date DESC, h.created_at DESC
    ) AS latest
    WHERE latest.employee_id = e.id
      AND e.employee_phase IS DISTINCT FROM latest.new_phase;`);
}
