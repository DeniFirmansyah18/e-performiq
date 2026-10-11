import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { computeTrainingDelta } from '@/lib/engines/training-effectiveness-engine';

/** Simpan skor pre/post test pada enrollment (HR/L&D). RBAC learning:manage. */
export async function recordTrainingScores(
  db: Db,
  session: SessionPayload,
  enrollmentId: number,
  preTestScore: number | null,
  postTestScore: number | null
) {
  assertCan(session, 'learning:manage');
  await db.execute(sql`
    UPDATE moodle_course_enrollments
       SET pre_test_score = ${preTestScore}, post_test_score = ${postTestScore}
     WHERE id = ${enrollmentId}
  `);
  return { enrollmentId };
}

/** Ringkasan efektivitas pelatihan karyawan: tiap enrollment + delta Kirkpatrick. */
export async function getTrainingEffectiveness(
  db: Db,
  session: SessionPayload,
  employeeId: string
) {
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, employeeId);

  const res = (await db.execute(sql`
    SELECT e.id AS "enrollmentId", mc.title AS "courseTitle",
           e.pre_test_score AS "preTestScore", e.post_test_score AS "postTestScore"
      FROM moodle_course_enrollments e
      JOIN moodle_courses mc ON mc.id = e.course_id
     WHERE e.employee_id = ${employeeId}::uuid
       AND e.post_test_score IS NOT NULL
     ORDER BY e.id DESC
  `)) as unknown as { rows: Array<Record<string, unknown>> };

  const items = (res.rows ?? []).map((r) => {
    const pre = Number(r.preTestScore ?? 0);
    const post = Number(r.postTestScore ?? 0);
    return {
      enrollmentId: Number(r.enrollmentId),
      courseTitle: r.courseTitle,
      ...computeTrainingDelta(pre, post),
    };
  });

  const meetingTarget = items.filter((i) => i.meetsTarget).length;
  return { total: items.length, meetingTarget, items };
}
