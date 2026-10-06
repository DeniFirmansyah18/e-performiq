import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { logAction } from '@/lib/services/auditService';

/** Field yang boleh diubah karyawan sendiri (allowlist). Field lain diabaikan. */
export const EDITABLE_PROFILE_FIELDS = [
  'phone_number',
  'address',
  'date_of_birth',
  'emergency_contact_name',
  'emergency_contact_phone',
  'photo_url',
  'bio',
] as const;

export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

const SELECT_PROFILE = (db: Db, employeeId: string) => sql`
  SELECT id, employee_code AS "employeeCode", full_name AS "fullName", email,
         phone_number AS "phoneNumber", department_id AS "departmentId", position_id AS "positionId",
         status, base_salary AS "baseSalary", join_date AS "joinDate",
         date_of_birth AS "dateOfBirth", address, emergency_contact_name AS "emergencyContactName",
         emergency_contact_phone AS "emergencyContactPhone", photo_url AS "photoUrl", bio
    FROM employees WHERE id = ${employeeId}::uuid
`;

export async function getMyProfile(db: Db, employeeId: string) {
  const res = (await db.execute(SELECT_PROFILE(db, employeeId))) as unknown as { rows: any[] };
  return res.rows[0] ?? null;
}

export type WorkPhase = 'PRE' | 'DURING' | 'POST';

export const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  PROBATION: 'Percobaan',
  PERMANENT: 'Tetap (Permanent)',
  CONTRACT: 'Kontrak',
  RESIGNED: 'Mengundurkan Diri',
  RETIRED: 'Pensiun',
};

/** Selisih tahun + bulan antara dua tanggal, untuk label "Masa Bakti". */
export function tenureParts(joinDate: string | Date | null, ref = new Date()) {
  if (!joinDate) return { years: 0, months: 0, label: '—' };
  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime())) return { years: 0, months: 0, label: '—' };
  let years = ref.getFullYear() - start.getFullYear();
  let months = ref.getMonth() - start.getMonth();
  if (ref.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0, label: '—' };
  const label = years > 0 ? `${years} Thn ${months} Bln` : `${months} Bln`;
  return { years, months, label };
}

/**
 * Profil siklus hidup karyawan: identitas (nama, NIP, jabatan, unit, atasan) +
 * status kepegawaian + progres fase (Sebelum/Saat/Setelah Kerja). Dipakai kartu
 * identitas portal karyawan sehingga menampilkan data akun yang sedang login.
 */
export async function getMyLifecycleProfile(db: Db, employeeId: string) {
  const res = (await db.execute(sql`
    SELECT e.id, e.employee_code AS "employeeCode", e.full_name AS "fullName",
           e.email, e.phone_number AS "phoneNumber", e.status, e.join_date AS "joinDate",
           e.last_working_day AS "lastWorkingDay", e.contract_end_date AS "contractEndDate",
           e.photo_url AS "photoUrl", e.bio,
           d.department_name AS "departmentName", jp.position_title AS "positionTitle",
           m.full_name AS "managerName", m.employee_code AS "managerCode"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN job_positions jp ON jp.id = e.position_id
      LEFT JOIN employees m ON m.id = e.manager_id
     WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: any[] };
  const row = res.rows[0];
  if (!row) return null;

  // Progres orientasi (fase Sebelum Kerja).
  const onbRes = (await db.execute(sql`
    SELECT om.day_30_score AS "day30", om.day_60_score AS "day60", om.day_90_score AS "day90",
           om.probation_passed AS "probationPassed", om.conversion_date AS "conversionDate",
           op.status AS "opStatus", op.application_id AS "applicationId",
           op.position_id AS "onboardingPositionId"
      FROM onboarding_milestones om
      LEFT JOIN onboarding_programs op ON op.employee_id = om.employee_id
     WHERE om.employee_id = ${employeeId}::uuid
     LIMIT 1
  `)) as unknown as { rows: any[] };
  const onb = onbRes.rows[0] ?? {};

  // Skor kinerja terakhir (fase Saat Kerja).
  const perfRes = (await db.execute(sql`
    SELECT pa.composite_gpa AS "gpa", pa.nine_box_quadrant AS "quadrant",
           ap.period_code AS "periodCode"
      FROM performance_appraisals pa
      LEFT JOIN appraisal_periods ap ON ap.id = pa.period_id
     WHERE pa.employee_id = ${employeeId}::uuid AND pa.composite_gpa IS NOT NULL
     ORDER BY ap.end_date DESC NULLS LAST
     LIMIT 1
  `)) as unknown as { rows: any[] };
  const perf = perfRes.rows[0] ?? null;

  // Status offboarding (fase Setelah Kerja).
  const offRes = (await db.execute(sql`
    SELECT status FROM offboarding_requests
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: any[] };
  const offboardingStatus: string | null = offRes.rows[0]?.status ?? null;

  const joinDate = row.joinDate ? new Date(row.joinDate).toISOString() : null;
  const tenure = tenureParts(joinDate);

  const milestones = [onb.day30, onb.day60, onb.day90].filter((v: any) => v != null).length;
  const status: string = row.status ?? 'PROBATION';
  const programStatus: string | null = onb.opStatus ?? null;
  // Program dianggap tuntas bila ditandai COMPLETED, atau masa percobaan lulus, atau 3 milestone lengkap.
  const orientationDone =
    programStatus === 'COMPLETED' || onb.probationPassed === true || milestones >= 3;

  // Fase: sudah ada offboarding = POST; masih orientasi/probation = PRE; else DURING.
  let phase: WorkPhase = 'DURING';
  if (offboardingStatus) phase = 'POST';
  else if (status === 'PROBATION' || (programStatus != null && !orientationDone)) phase = 'PRE';

  const period =
    perf?.periodCode ??
    `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;

  return {
    ...row,
    joinDate,
    tenure,
    statusLabel: EMPLOYEE_STATUS_LABEL[status] ?? status,
    phase,
    cycle: period,
    onboarding: {
      programStatus,
      milestonesDone: milestones,
      milestonesTotal: 3,
      probationPassed: onb.probationPassed ?? null,
      conversionDate: onb.conversionDate ?? null,
      applicationId: onb.applicationId ?? null,
    },
    performance: perf
      ? { gpa: perf.gpa != null ? Number(perf.gpa) : null, quadrant: perf.quadrant, period }
      : { gpa: null, quadrant: null, period },
    offboardingStatus,
  };
}

/**
 * Memperbarui profil karyawan (hanya field allowlist). Field sensitif (base_salary,
 * position_id, employee_code, dll) diabaikan. Menulis satu baris audit_logs.
 */
export async function updateMyProfile(
  db: Db,
  employeeId: string,
  fields: Record<string, unknown>,
  actorUserId: string
) {
  const before = await getMyProfile(db, employeeId);
  const allowed: Record<string, unknown> = {};
  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) allowed[key] = fields[key];
  }
  if (Object.keys(allowed).length === 0) return before;

  // Bangun SET dinamis dengan parameter aman via sql.raw atas nama kolom allowlist.
  const assignments = Object.entries(allowed).map(([k, v]) => sql`${sql.raw(k)} = ${v}`);
  await db.execute(sql`
    UPDATE employees SET ${sql.join(assignments, sql`, `)} WHERE id = ${employeeId}::uuid
  `);

  const after = await getMyProfile(db, employeeId);
  await logAction(db, {
    userId: actorUserId,
    actionType: 'UPDATE',
    entityName: 'employees',
    recordId: employeeId,
    oldData: before,
    newData: after,
    description: 'Self-service profile update',
  });
  return after;
}
