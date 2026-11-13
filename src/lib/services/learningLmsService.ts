import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { resolveCompletionState, type CompletionState } from '@/lib/engines/completion-engine';
import { onCourseCompleted } from '@/lib/services/lmsObserver';

export interface CourseCatalogItem {
  id: number;
  courseCode: string;
  title: string;
  category: string | null;
  targetPhase: 'PRE' | 'DURING' | 'POST';
  isMandatory: boolean;
  defaultHours: number;
}

/** Katalog kursus (opsional difilter per fase lifecycle). */
export async function listCourses(db: Db, phase?: 'PRE' | 'DURING' | 'POST'): Promise<CourseCatalogItem[]> {
  const res = (await db.execute(sql`
    SELECT id, course_code AS "courseCode", title, category,
           target_phase AS "targetPhase", is_mandatory AS "isMandatory",
           default_hours AS "defaultHours"
      FROM moodle_courses
     WHERE is_active = TRUE
       AND (${phase ?? null}::text IS NULL OR target_phase = ${phase ?? null}::course_phase_enum)
     ORDER BY target_phase, course_code
  `)) as unknown as { rows: CourseCatalogItem[] };
  return (res.rows ?? []).map((r) => ({ ...r, id: Number(r.id), defaultHours: Number(r.defaultHours) }));
}

/** Daftar kursus (native, idempoten). Menetapkan status IN_PROGRESS. */
export async function enrollLocal(db: Db, employeeId: string, courseId: number) {
  const course = (await db.execute(sql`
    SELECT course_code AS "code", title FROM moodle_courses WHERE id = ${courseId}
  `)) as unknown as { rows: Array<{ code: string; title: string }> };
  const code = course.rows[0]?.code ?? String(courseId);
  const title = course.rows[0]?.title ?? code;

  const res = (await db.execute(sql`
    INSERT INTO moodle_course_enrollments (employee_id, moodle_course_id, course_title, completion_pct, completion_state)
    VALUES (${employeeId}::uuid, ${courseId}, ${title}, 0.00, 'IN_PROGRESS')
    ON CONFLICT (employee_id, moodle_course_id)
    DO UPDATE SET course_title = EXCLUDED.course_title,
                  completion_state = CASE WHEN moodle_course_enrollments.completion_state = 'COMPLETE'
                                          THEN 'COMPLETE'::completion_state_enum ELSE 'IN_PROGRESS'::completion_state_enum END
    RETURNING id, moodle_course_id AS "courseId", completion_pct AS "completionPct", completion_state AS "completionState"
  `)) as unknown as { rows: any[] };
  const row = res.rows[0];
  return {
    id: row.id,
    courseId: Number(row.courseId),
    completionPct: Number(row.completionPct),
    completionState: row.completionState as CompletionState,
  };
}

/** Memperbarui progres kursus (persen + menit). */
export async function recordProgress(db: Db, employeeId: string, courseId: number, pct: number, minutes = 0) {
  const state = resolveCompletionState(pct);
  await db.execute(sql`
    UPDATE moodle_course_enrollments
       SET completion_pct = ${pct}, time_spent_minutes = COALESCE(time_spent_minutes,0) + ${minutes},
           completion_state = ${state}::completion_state_enum, last_activity_at = CURRENT_TIMESTAMP
     WHERE employee_id = ${employeeId}::uuid AND moodle_course_id = ${courseId}
  `);
  return { courseId, completionPct: pct, completionState: state };
}

/** Menandai kursus selesai dan memicu observer (evidence + badge) + onboarding. */
export async function completeCourse(db: Db, employeeId: string, courseId: number) {
  await db.execute(sql`
    UPDATE moodle_course_enrollments
       SET completion_pct = 100, completion_state = 'COMPLETE'::completion_state_enum,
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
     WHERE employee_id = ${employeeId}::uuid AND moodle_course_id = ${courseId}
  `);
  const observer = await onCourseCompleted(db, employeeId, courseId);
  // Bila karyawan punya program onboarding, cek kelengkapan & terbitkan e-sertifikat.
  let onboarding: { status: string; issuedCertificates: number[] } | null = null;
  try {
    const { onCourseCompletedForOnboarding } = await import('@/lib/services/onboardingService');
    const r = await onCourseCompletedForOnboarding(db, employeeId);
    if (r) onboarding = { status: r.status, issuedCertificates: r.issuedCertificates };
  } catch {
    /* onboarding opsional */
  }
  return { courseId, completionState: 'COMPLETE' as CompletionState, ...observer, onboarding };
}

// ---------------------------------------------------------------------------
// Penyuntingan kursus & modul oleh HR
// ---------------------------------------------------------------------------

export interface UbahKursusInput {
  title?: string;
  category?: string | null;
  description?: string | null;
  hours?: number;
}

/** Ubah atribut kursus yang sudah dipetakan (HR menyesuaikan ke perusahaan). */
export async function ubahKursus(db: Db, courseId: number, input: UbahKursusInput): Promise<void> {
  await db.execute(sql`
    UPDATE moodle_courses SET
      title = COALESCE(${input.title ?? null}, title),
      category = COALESCE(${input.category ?? null}, category),
      description = COALESCE(${input.description ?? null}, description),
      default_hours = COALESCE(${input.hours ?? null}, default_hours)
    WHERE id = ${courseId}
  `);
}

export interface ModulKursus {
  id: number;
  title: string;
  orderIndex: number;
  contentType: string;
  contentUrl: string | null;
  contentBody: string | null;
}

/** Daftar modul/materi sebuah kursus. */
export async function daftarModulKursus(db: Db, courseId: number): Promise<ModulKursus[]> {
  const res = (await db.execute(sql`
    SELECT id, title, order_index AS "orderIndex", content_type AS "contentType",
           content_url AS "contentUrl", content_body AS "contentBody"
      FROM course_modules WHERE course_id = ${courseId} ORDER BY order_index, id
  `)) as unknown as { rows: ModulKursus[] };
  return res.rows ?? [];
}

/**
 * Tambah modul materi buatan HR sendiri.
 *
 * Tautan wajib lolos pemeriksaan: domain OER tepercaya dan bukan berbayar —
 * aturan yang sama dengan materi hasil AI, agar kualitas kursus seragam.
 */
export async function tambahModulMateri(
  db: Db,
  courseId: number,
  input: { title: string; contentType?: string; contentUrl?: string | null; contentBody?: string | null }
): Promise<{ id: number }> {
  const jenis = input.contentType ?? 'TEXT';
  if ((jenis === 'VIDEO' || jenis === 'PDF') && input.contentUrl) {
    const { validateModuleUrl } = await import('@/lib/services/oerCatalogService');
    const { periksaStatisOer } = await import('@/lib/services/oerLinkValidator');
    const domain = validateModuleUrl(jenis, input.contentUrl);
    if (!domain.ok) throw new Error(domain.reason ?? 'Tautan materi tidak valid.');
    const gratis = periksaStatisOer(input.contentUrl);
    if (!gratis.gratis) throw new Error(gratis.alasan ?? 'Tautan materi harus gratis.');
  }

  const maks = (await db.execute(sql`
    SELECT COALESCE(MAX(order_index), 0)::int AS n FROM course_modules WHERE course_id = ${courseId}
  `)) as unknown as { rows: Array<{ n: number }> };

  const res = (await db.execute(sql`
    INSERT INTO course_modules (course_id, title, order_index, content_type, content_url, content_body)
    VALUES (${courseId}, ${input.title}, ${Number(maks.rows?.[0]?.n ?? 0) + 1},
            ${jenis}::content_type_enum, ${input.contentUrl ?? null}, ${input.contentBody ?? null})
    RETURNING id
  `)) as unknown as { rows: Array<{ id: number }> };
  return { id: Number(res.rows[0].id) };
}

/** Ubah modul/materi kursus. Tautan baru divalidasi seperti saat menambah. */
export async function ubahModul(
  db: Db,
  moduleId: number,
  input: { title?: string; contentUrl?: string | null; contentBody?: string | null; contentType?: string }
): Promise<void> {
  if (input.contentUrl) {
    const { validateModuleUrl } = await import('@/lib/services/oerCatalogService');
    const { periksaStatisOer } = await import('@/lib/services/oerLinkValidator');
    const jenis = input.contentType ?? 'VIDEO';
    const domain = validateModuleUrl(jenis, input.contentUrl);
    if (!domain.ok) throw new Error(domain.reason ?? 'Tautan materi tidak valid.');
    const gratis = periksaStatisOer(input.contentUrl);
    if (!gratis.gratis) throw new Error(gratis.alasan ?? 'Tautan materi harus gratis.');
  }

  await db.execute(sql`
    UPDATE course_modules SET
      title = COALESCE(${input.title ?? null}, title),
      content_url = COALESCE(${input.contentUrl ?? null}, content_url),
      content_body = COALESCE(${input.contentBody ?? null}, content_body)
    WHERE id = ${moduleId}
  `);
}
