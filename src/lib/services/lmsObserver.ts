import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { evaluateBadgeCriteria, type BadgeCriterion } from '@/lib/engines/badge-award-engine';

/**
 * Observer: orkestrasi idempoten saat sebuah course diselesaikan (mengadopsi pola
 * event/observer Moodle). course completion -> competency_evidence -> badge_awards.
 * Semua INSERT idempoten (ON CONFLICT DO NOTHING) agar aman dipanggil berulang.
 */
export async function onCourseCompleted(
  db: Db,
  employeeId: string,
  courseId: number
): Promise<{ evidenceCreated: number; badgesAwarded: string[] }> {
  // 1) Evidence dari course_competencies (outcome <> 'NONE').
  const links = (await db.execute(sql`
    SELECT competency_id AS "competencyId", outcome
      FROM course_competencies WHERE course_id = ${courseId}
  `)) as unknown as { rows: Array<{ competencyId: string; outcome: string }> };

  let evidenceCreated = 0;
  for (const link of links.rows) {
    if (link.outcome === 'NONE') continue;
    const action = link.outcome === 'COMPLETE' ? 'COMPLETE' : 'LOG';
    const res = (await db.execute(sql`
      INSERT INTO competency_evidence (employee_id, competency_id, source, course_id, rating, action)
      VALUES (${employeeId}::uuid, ${link.competencyId}::uuid, 'COURSE', ${courseId}, 4, ${action}::evidence_action_enum)
      ON CONFLICT (employee_id, competency_id, course_id) DO NOTHING
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };
    evidenceCreated += res.rows.length;
  }

  // 2) Build context: completed courses + derived competency levels.
  const completed = (await db.execute(sql`
    SELECT moodle_course_id AS "courseId" FROM moodle_course_enrollments
     WHERE employee_id = ${employeeId}::uuid AND completion_state = 'COMPLETE'
  `)) as unknown as { rows: Array<{ courseId: number }> };
  const completedCourseIds = completed.rows.map((r) => Number(r.courseId));
  if (!completedCourseIds.includes(courseId)) completedCourseIds.push(courseId);

  const levels = (await db.execute(sql`
    SELECT competency_id AS "competencyId", ROUND(AVG(rating))::int AS "level"
      FROM competency_evidence WHERE employee_id = ${employeeId}::uuid
     GROUP BY competency_id
  `)) as unknown as { rows: Array<{ competencyId: string; level: number }> };
  const competencyLevels: Record<string, number> = {};
  for (const l of levels.rows) competencyLevels[l.competencyId] = Number(l.level);

  // 3) Evaluasi badge aktif.
  const badgeRows = (await db.execute(sql`
    SELECT b.id, b.code FROM badges b WHERE b.is_active = TRUE
  `)) as unknown as { rows: Array<{ id: string; code: string }> };

  const ctx = { completedCourseIds, competencyLevels };
  const awarded: string[] = [];
  for (const badge of badgeRows.rows) {
    const crit = (await db.execute(sql`
      SELECT criteria_type AS "criteriaType", course_id AS "courseId",
             competency_id AS "competencyId", min_level AS "minLevel"
        FROM badge_criteria WHERE badge_id = ${badge.id}::uuid
    `)) as unknown as { rows: BadgeCriterion[] };
    if (crit.rows.length === 0) continue;
    if (!evaluateBadgeCriteria(crit.rows, ctx)) continue;
    const ins = (await db.execute(sql`
      INSERT INTO badge_awards (badge_id, employee_id, evidence_ref)
      VALUES (${badge.id}::uuid, ${employeeId}::uuid, ${'course:' + courseId})
      ON CONFLICT (badge_id, employee_id) DO NOTHING
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };
    if (ins.rows.length > 0) awarded.push(badge.code);
  }

  return { evidenceCreated, badgesAwarded: awarded };
}
