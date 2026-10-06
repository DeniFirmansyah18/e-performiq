import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ScheduleSchema = z.object({
  applicationId: z.string().uuid(),
  interviewerUserId: z.string().uuid().optional(),
  scheduledAt: z.string().min(10).max(40),
  meetingUrl: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
});

// POST /api/v1/recruitment/interviews — jadwalkan wawancara (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = ScheduleSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data jadwal tidak valid.', 400);

    const res = (await db.execute(sql`
      INSERT INTO interview_schedules
        (application_id, interviewer_user_id, scheduled_at, meeting_url, duration_minutes, status)
      VALUES (${parsed.data.applicationId}::uuid, ${parsed.data.interviewerUserId ?? session.userId}::uuid,
              ${parsed.data.scheduledAt}::timestamptz, ${parsed.data.meetingUrl ?? null},
              ${parsed.data.durationMinutes ?? 45}, 'SCHEDULED')
      RETURNING id, scheduled_at AS "scheduledAt", status
    `)) as unknown as { rows: any[] };
    const row = res.rows[0];

    // Sinkronkan timeline (INTERVIEW → SCHEDULED).
    try {
      const { syncApplicationTimeline } = await import('@/lib/services/timelineService');
      await syncApplicationTimeline(db, parsed.data.applicationId);
    } catch {
      /* opsional */
    }
    return ok(row, 'Wawancara dijadwalkan.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/interviews');
  }
}

// GET /api/v1/recruitment/interviews?applicationId=... — daftar jadwal (HR)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const applicationId = req.nextUrl.searchParams.get('applicationId');
    const res = (await db.execute(sql`
      SELECT i.id, i.application_id AS "applicationId", i.scheduled_at AS "scheduledAt",
             i.meeting_url AS "meetingUrl", i.duration_minutes AS "durationMinutes",
             i.status, i.score::float8 AS score, i.notes,
             COALESCE(e.full_name, u.email) AS "interviewerName"
        FROM interview_schedules i
        LEFT JOIN users u ON u.id = i.interviewer_user_id
        LEFT JOIN employees e ON e.id = u.employee_id
       WHERE (${applicationId ?? null}::uuid IS NULL OR i.application_id = ${applicationId ?? null}::uuid)
       ORDER BY i.scheduled_at DESC
       LIMIT 100
    `)) as unknown as { rows: any[] };
    return ok({ interviews: res.rows ?? [] });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/interviews');
  }
}
