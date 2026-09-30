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

/** Menandai kursus selesai dan memicu observer (evidence + badge). */
export async function completeCourse(db: Db, employeeId: string, courseId: number) {
  await db.execute(sql`
    UPDATE moodle_course_enrollments
       SET completion_pct = 100, completion_state = 'COMPLETE'::completion_state_enum,
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
     WHERE employee_id = ${employeeId}::uuid AND moodle_course_id = ${courseId}
  `);
  const observer = await onCourseCompleted(db, employeeId, courseId);
  return { courseId, completionState: 'COMPLETE' as CompletionState, ...observer };
}
