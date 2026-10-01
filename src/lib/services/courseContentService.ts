import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { computeCourseProgress } from '@/lib/engines/completion-engine';
import { gradeQuiz } from '@/lib/engines/quiz-engine';
import { onCourseCompleted } from '@/lib/services/lmsObserver';
import { issueCertificate } from '@/lib/services/certificateService';

export interface CourseModuleItem {
  id: string;
  title: string;
  orderIndex: number;
  contentType: 'TEXT' | 'VIDEO' | 'PDF' | 'QUIZ';
  completed: boolean;
}

/** Daftar modul sebuah kursus, dengan status penyelesaian karyawan (bila ada). */
export async function listModules(db: Db, courseId: number, employeeId?: string): Promise<CourseModuleItem[]> {
  const res = (await db.execute(sql`
    SELECT m.id, m.title, m.order_index AS "orderIndex", m.content_type AS "contentType",
           (cc.id IS NOT NULL) AS "completed"
      FROM course_modules m
      LEFT JOIN course_completions cc ON cc.module_id = m.id AND cc.employee_id = ${employeeId ?? null}::uuid
     WHERE m.course_id = ${courseId}
     ORDER BY m.order_index ASC
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    orderIndex: Number(r.orderIndex),
    contentType: r.contentType,
    completed: Boolean(r.completed),
  }));
}

/** Isi satu modul/lesson (termasuk quiz_key bila QUIZ). */
export async function getLesson(db: Db, moduleId: string) {
  const res = (await db.execute(sql`
    SELECT id, course_id AS "courseId", title, order_index AS "orderIndex",
           content_type AS "contentType", content_url AS "contentUrl", content_body AS "contentBody",
           quiz_key AS "quizKey"
      FROM course_modules WHERE id = ${moduleId}::uuid
  `)) as unknown as { rows: any[] };
  const row = res.rows[0];
  if (!row) return null;
  return { ...row, courseId: Number(row.courseId), quizKey: row.quizKey ?? undefined };
}

async function progressFor(db: Db, employeeId: string, courseId: number): Promise<number> {
  const mods = (await db.execute(sql`
    SELECT (cc.id IS NOT NULL) AS "completed"
      FROM course_modules m
      LEFT JOIN course_completions cc ON cc.module_id = m.id AND cc.employee_id = ${employeeId}::uuid
     WHERE m.course_id = ${courseId}
  `)) as unknown as { rows: Array<{ completed: boolean }> };
  return computeCourseProgress((mods.rows ?? []).map((r) => ({ completed: Boolean(r.completed) })));
}

/**
 * Menandai modul selesai (idempoten). Menghitung ulang progres kursus; bila 100%:
 * memanggil observer (evidence + badge) dan menerbitkan sertifikat untuk kursus wajib.
 */
export async function completeModule(db: Db, employeeId: string, moduleId: string) {
  const mod = (await db.execute(sql`
    SELECT course_id AS "courseId" FROM course_modules WHERE id = ${moduleId}::uuid
  `)) as unknown as { rows: Array<{ courseId: number }> };
  const courseId = Number(mod.rows[0]?.courseId);
  if (!courseId) return { courseId: 0, progress: 0, completed: false };

  await db.execute(sql`
    INSERT INTO course_completions (employee_id, course_id, module_id)
    VALUES (${employeeId}::uuid, ${courseId}, ${moduleId}::uuid)
    ON CONFLICT (employee_id, module_id) DO NOTHING
  `);

  const progress = await progressFor(db, employeeId, courseId);
  const done = progress >= 100;
  const nextState = done ? 'COMPLETE' : progress > 0 ? 'IN_PROGRESS' : null;

  await db.execute(sql`
    UPDATE moodle_course_enrollments
       SET completion_pct = ${progress},
           completion_state = COALESCE(${nextState}::completion_state_enum, completion_state),
           completed_at = CASE WHEN ${done} THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
           last_activity_at = CURRENT_TIMESTAMP
     WHERE employee_id = ${employeeId}::uuid AND moodle_course_id = ${courseId}
  `);

  let certificate: any = null;
  if (done) {
    await onCourseCompleted(db, employeeId, courseId);
    const mandatory = (await db.execute(sql`
      SELECT is_mandatory AS "isMandatory" FROM moodle_courses WHERE id = ${courseId}
    `)) as unknown as { rows: Array<{ isMandatory: boolean }> };
    if (mandatory.rows[0]?.isMandatory) {
      certificate = await issueCertificate(db, employeeId, courseId);
    }
  }

  return { courseId, progress, completed: true, certificate };
}

/** Menilai kuis; bila lulus, modul ditandai selesai. */
export async function submitQuiz(db: Db, employeeId: string, moduleId: string, answers: number[]) {
  const mod = (await db.execute(sql`
    SELECT quiz_key AS "quizKey", course_id AS "courseId" FROM course_modules WHERE id = ${moduleId}::uuid
  `)) as unknown as { rows: Array<{ quizKey: any; courseId: number }> };
  const key = mod.rows[0]?.quizKey ?? [];
  const grade = gradeQuiz(answers, Array.isArray(key) ? key : []);
  let certificate: any = null;
  if (grade.passed) {
    const res = await completeModule(db, employeeId, moduleId);
    certificate = res.certificate ?? null;
  }
  return { ...grade, completed: grade.passed, certificate };
}
