import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { computeTrainingHours } from '@/lib/engines/training-hours-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/my-learning
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const employeeId = session.employeeId;

    if (!employeeId) return ok({ courses: [], trainingHours: 0, badges: [] });

    const enrollments = (await db.execute(sql`
      SELECT e.moodle_course_id AS "courseId", e.course_title AS "title",
             e.completion_pct AS "completionPct", e.completion_state AS "completionState",
             COALESCE(e.time_spent_minutes,0) AS "timeSpentMinutes"
        FROM moodle_course_enrollments e
       WHERE e.employee_id = ${employeeId}::uuid
       ORDER BY e.enrolled_at DESC
    `)) as unknown as { rows: any[] };

    const courses = (enrollments.rows ?? []).map((r) => ({
      courseId: Number(r.courseId),
      title: r.title,
      completionPct: Number(r.completionPct),
      completionState: r.completionState,
      timeSpentMinutes: Number(r.timeSpentMinutes),
    }));
    const trainingHours = computeTrainingHours(courses.map((c) => ({ timeSpentMinutes: c.timeSpentMinutes })));

    const badges = (await db.execute(sql`
      SELECT b.code, b.name, (ba.id IS NOT NULL) AS "earned"
        FROM badges b
        LEFT JOIN badge_awards ba ON ba.badge_id = b.id AND ba.employee_id = ${employeeId}::uuid
       WHERE b.is_active = TRUE ORDER BY b.code
    `)) as unknown as { rows: any[] };

    return ok({
      courses,
      trainingHours,
      badges: (badges.rows ?? []).map((b) => ({ code: b.code, name: b.name, earned: Boolean(b.earned) })),
    });
  } catch (err) {
    return problem(err, '/api/v1/learning/my-learning');
  }
}
