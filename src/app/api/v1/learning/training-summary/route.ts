import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { computeTrainingHours } from '@/lib/engines/training-hours-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/training-summary - agregat untuk HR (per fase, badge, jam).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');

    const byPhase = (await db.execute(sql`
      SELECT c.target_phase AS "phase",
             COUNT(*)::int AS "enrolled",
             COUNT(*) FILTER (WHERE e.completion_state = 'COMPLETE')::int AS "completed"
        FROM moodle_course_enrollments e
        JOIN moodle_courses c ON c.id = e.moodle_course_id
       GROUP BY c.target_phase ORDER BY c.target_phase
    `)) as unknown as { rows: any[] };

    const hours = (await db.execute(sql`
      SELECT COALESCE(SUM(time_spent_minutes),0)::int AS "minutes" FROM moodle_course_enrollments
    `)) as unknown as { rows: Array<{ minutes: number }> };

    const badgeCount = (await db.execute(sql`
      SELECT COUNT(*)::int AS "issued" FROM badge_awards
    `)) as unknown as { rows: Array<{ issued: number }> };

    return ok({
      byPhase: (byPhase.rows ?? []).map((r) => ({
        phase: r.phase,
        enrolled: Number(r.enrolled),
        completed: Number(r.completed),
        completionRate: Number(r.enrolled) > 0 ? Number(((Number(r.completed) / Number(r.enrolled)) * 100).toFixed(1)) : 0,
      })),
      totalTrainingHours: computeTrainingHours([{ timeSpentMinutes: Number(hours.rows[0]?.minutes ?? 0) }]),
      badgesIssued: Number(badgeCount.rows[0]?.issued ?? 0),
    });
  } catch (err) {
    return problem(err, '/api/v1/learning/training-summary');
  }
}
