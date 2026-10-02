/**
 * Onboarding Service (WS-8) — program onboarding LMS per-posisi + e-sertifikat.
 *
 * Alur:
 *  1. Karyawan baru (mis. kandidat ACCEPTED → onboarding) memiliki posisi.
 *  2. `generateOnboardingProgram()` membuat program + learning plan + mendaftarkan
 *     kursus WAJIB posisi (dari `position_courses`) ke `moodle_course_enrollments`.
 *  3. Karyawan menyelesaikan kursus (via learningLmsService.completeCourse).
 *  4. `refreshOnboardingStatus()` memeriksa kelengkapan; bila SEMUA kursus wajib
 *     selesai → terbitkan e-sertifikat (idempoten) & tandai program COMPLETED.
 *
 * Deterministik, driver-agnostic, best-effort.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface PositionCourse {
  courseId: number;
  courseCode: string;
  title: string;
  category: string | null;
  isMandatory: boolean;
  orderIndex: number;
  defaultHours: number;
}

/** Kurikulum kursus untuk sebuah posisi (dari `position_courses`). */
export async function listPositionCourses(db: Db, positionId: string): Promise<PositionCourse[]> {
  const res = (await db.execute(sql`
    SELECT c.id AS "courseId", c.course_code AS "courseCode", c.title, c.category,
           pc.is_mandatory AS "isMandatory", pc.order_index AS "orderIndex",
           c.default_hours::float8 AS "defaultHours"
      FROM position_courses pc
      JOIN moodle_courses c ON c.id = pc.course_id
     WHERE pc.position_id = ${positionId}::uuid AND c.is_active = TRUE
     ORDER BY pc.order_index
  `)) as unknown as { rows: Array<PositionCourse & { courseId: unknown; defaultHours: unknown }> };
  return (res.rows ?? []).map((r) => ({ ...r, courseId: Number(r.courseId), defaultHours: Number(r.defaultHours) }));
}

export interface OnboardingItem {
  courseId: number;
  courseCode: string;
  title: string;
  isMandatory: boolean;
  enrolled: boolean;
  completionPct: number;
  completionState: string | null;
  certified: boolean;
}

export interface OnboardingStatus {
  employeeId: string;
  programId: string | null;
  planId: string | null;
  positionId: string | null;
  positionTitle: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'WAIVED';
  totalMandatory: number;
  completedMandatory: number;
  progressPct: number;
  items: OnboardingItem[];
}

/**
 * Membuat (atau mengambil) program onboarding untuk seorang karyawan:
 * learning plan + pendaftaran kursus wajib posisi. Idempoten.
 */
export async function generateOnboardingProgram(
  db: Db,
  payload: { employeeId: string; applicationId?: string | null },
): Promise<{ programId: string; planId: string; enrolled: number }> {
  // Posisi karyawan.
  const emp = (await db.execute(sql`
    SELECT e.position_id AS "positionId", e.full_name AS "fullName", p.position_title AS "positionTitle"
      FROM employees e JOIN job_positions p ON p.id = e.position_id
     WHERE e.id = ${payload.employeeId}::uuid
  `)) as unknown as { rows: Array<{ positionId: string; fullName: string; positionTitle: string }> };
  const positionId = emp.rows[0]?.positionId ?? null;
  const positionTitle = emp.rows[0]?.positionTitle ?? 'Karyawan Baru';
  const fullName = emp.rows[0]?.fullName ?? 'Karyawan';

  // Learning plan (IDP) onboarding. Ambil bila sudah ada (idempoten via program).
  const existing = (await db.execute(sql`
    SELECT id, plan_id AS "planId" FROM onboarding_programs WHERE employee_id = ${payload.employeeId}::uuid
  `)) as unknown as { rows: Array<{ id: string; planId: string | null }> };
  if (existing.rows[0]?.planId) {
    const enrolled = await enrollMandatoryCourses(db, payload.employeeId, positionId);
    return { programId: existing.rows[0].id, planId: existing.rows[0].planId, enrolled };
  }

  // Buat learning plan baru.
  const plan = (await db.execute(sql`
    INSERT INTO learning_plans (employee_id, title, status)
    VALUES (${payload.employeeId}::uuid, ${`Onboarding: ${fullName} (${positionTitle})`}, 'ACTIVE'::plan_status_enum)
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const planId = plan.rows[0].id;

  // Item plan per kursus wajib.
  const courses = positionId ? await listPositionCourses(db, positionId) : [];
  const mandatory = courses.filter((c) => c.isMandatory);
  for (const c of mandatory) {
    await db.execute(sql`
      INSERT INTO learning_plan_items (plan_id, course_id, status)
      VALUES (${planId}::uuid, ${c.courseId}, 'TODO'::plan_item_status_enum)
    `);
  }

  // Program onboarding.
  const prog = (await db.execute(sql`
    INSERT INTO onboarding_programs (employee_id, application_id, position_id, plan_id, status)
    VALUES (${payload.employeeId}::uuid, ${payload.applicationId ?? null}::uuid, ${positionId}::uuid,
            ${planId}::uuid, 'IN_PROGRESS'::onboarding_status_enum)
    ON CONFLICT (employee_id)
    DO UPDATE SET plan_id = COALESCE(onboarding_programs.plan_id, EXCLUDED.plan_id),
                  application_id = COALESCE(onboarding_programs.application_id, EXCLUDED.application_id)
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };

  const enrolled = await enrollMandatoryCourses(db, payload.employeeId, positionId);
  return { programId: prog.rows[0].id, planId, enrolled };
}

/** Mendaftarkan karyawan ke semua kursus WAJIB posisinya (idempoten). */
async function enrollMandatoryCourses(db: Db, employeeId: string, positionId: string | null): Promise<number> {
  if (!positionId) return 0;
  const courses = (await listPositionCourses(db, positionId)).filter((c) => c.isMandatory);
  let n = 0;
  for (const c of courses) {
    const res = (await db.execute(sql`
      INSERT INTO moodle_course_enrollments (employee_id, moodle_course_id, course_title, completion_pct, completion_state)
      VALUES (${employeeId}::uuid, ${c.courseId}, ${c.title}, 0.00, 'NOT_STARTED'::completion_state_enum)
      ON CONFLICT (employee_id, moodle_course_id) DO NOTHING
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };
    if (res.rows[0]) n += 1;
  }
  return n;
}

/** Status ringkas program onboarding + daftar item kursus. */
export async function getOnboardingStatus(db: Db, employeeId: string): Promise<OnboardingStatus> {
  const prog = (await db.execute(sql`
    SELECT op.id AS "programId", op.plan_id AS "planId", op.position_id AS "positionId",
           op.status::text AS "status", p.position_title AS "positionTitle"
      FROM onboarding_programs op
      LEFT JOIN job_positions p ON p.id = op.position_id
     WHERE op.employee_id = ${employeeId}::uuid
  `)) as unknown as { rows: any[] };
  const program = prog.rows?.[0];

  const positionId = program?.positionId ?? (await positionIdOf(db, employeeId));
  const courses = positionId ? await listPositionCourses(db, positionId) : [];

  const enrolls = (await db.execute(sql`
    SELECT moodle_course_id AS "courseId", completion_pct::float8 AS "completionPct",
           completion_state::text AS "completionState"
      FROM moodle_course_enrollments WHERE employee_id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ courseId: number; completionPct: number; completionState: string | null }> };
  const enrollMap = new Map(enrolls.rows.map((e) => [Number(e.courseId), e]));

  const certs = (await db.execute(sql`
    SELECT course_id AS "courseId" FROM certificates WHERE employee_id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ courseId: number }> };
  const certSet = new Set(certs.rows.map((c) => Number(c.courseId)));

  const items: OnboardingItem[] = courses.map((c) => {
    const e = enrollMap.get(c.courseId);
    return {
      courseId: c.courseId,
      courseCode: c.courseCode,
      title: c.title,
      isMandatory: c.isMandatory,
      enrolled: !!e,
      completionPct: e ? Number(e.completionPct) : 0,
      completionState: e?.completionState ?? null,
      certified: certSet.has(c.courseId),
    };
  });

  const mandatory = items.filter((i) => i.isMandatory);
  const completedMandatory = mandatory.filter((i) => i.completionState === 'COMPLETE').length;
  const progressPct = mandatory.length > 0 ? Math.round((completedMandatory / mandatory.length) * 100) : 0;

  return {
    employeeId,
    programId: program?.programId ?? null,
    planId: program?.planId ?? null,
    positionId: positionId ?? null,
    positionTitle: program?.positionTitle ?? null,
    status: (program?.status as OnboardingStatus['status']) ?? 'IN_PROGRESS',
    totalMandatory: mandatory.length,
    completedMandatory,
    progressPct,
    items,
  };
}

async function positionIdOf(db: Db, employeeId: string): Promise<string | null> {
  const r = (await db.execute(sql`
    SELECT position_id AS "positionId" FROM employees WHERE id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ positionId: string | null }> };
  return r.rows?.[0]?.positionId ?? null;
}

export interface CompletionResult {
  status: 'IN_PROGRESS' | 'COMPLETED';
  completedMandatory: number;
  totalMandatory: number;
  issuedCertificates: number[];
}

/**
 * Periksa kelengkapan onboarding: bila semua kursus WAJIB selesai →
 * terbitkan e-sertifikat untuk kursus wajib & tandai program COMPLETED.
 */
export async function refreshOnboardingStatus(db: Db, employeeId: string): Promise<CompletionResult> {
  const status = await getOnboardingStatus(db, employeeId);
  const mandatory = status.items.filter((i) => i.isMandatory);
  const allDone = mandatory.length > 0 && mandatory.every((i) => i.completionState === 'COMPLETE');
  const issued: number[] = [];

  if (allDone) {
    // Selesaikan item plan + terbitkan sertifikat (idempoten).
    try {
      const { issueCertificate } = await import('@/lib/services/certificateService');
      for (const i of mandatory) {
        if (!i.certified) {
          await issueCertificate(db, employeeId, i.courseId);
          issued.push(i.courseId);
        }
      }
    } catch (err) {
      console.warn('[onboardingService] gagal terbitkan sertifikat:', (err as Error)?.message);
    }

    // Tandai item plan DONE.
    if (status.planId) {
      await db.execute(sql`
        UPDATE learning_plan_items SET status = 'DONE'::plan_item_status_enum
         WHERE plan_id = ${status.planId}::uuid
      `);
    }
    // Tandai program COMPLETED.
    await db.execute(sql`
      UPDATE onboarding_programs
         SET status = 'COMPLETED'::onboarding_status_enum, completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
       WHERE employee_id = ${employeeId}::uuid
    `);
  }

  return {
    status: allDone ? 'COMPLETED' : 'IN_PROGRESS',
    completedMandatory: mandatory.filter((i) => i.completionState === 'COMPLETE').length,
    totalMandatory: mandatory.length,
    issuedCertificates: issued,
  };
}

/**
 * Dipanggil setelah kursus selesai: bila karyawan punya program onboarding,
 * perbarui statusnya (dan terbitkan sertifikat bila lengkap).
 */
export async function onCourseCompletedForOnboarding(db: Db, employeeId: string): Promise<CompletionResult | null> {
  const hasProgram = (await db.execute(sql`
    SELECT 1 FROM onboarding_programs WHERE employee_id = ${employeeId}::uuid AND status = 'IN_PROGRESS'
  `)) as unknown as { rows: unknown[] };
  if (!hasProgram.rows?.length) return null;
  return refreshOnboardingStatus(db, employeeId);
}
