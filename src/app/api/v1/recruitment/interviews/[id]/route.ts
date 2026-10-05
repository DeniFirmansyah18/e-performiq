import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  status: z.enum(['DONE', 'CANCELED']),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

// PATCH /api/v1/recruitment/interviews/:id — tandai wawancara selesai/dibatalkan (HR).
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Data tidak valid.', 400);

    const res = (await db.execute(sql`
      UPDATE interview_schedules
         SET status = ${parsed.data.status},
             score = COALESCE(${parsed.data.score ?? null}, score),
             notes = COALESCE(${parsed.data.notes ?? null}, notes)
       WHERE id = ${ctx.params.id}::uuid
      RETURNING id, application_id AS "applicationId", status, meeting_url AS "meetingUrl"
    `)) as unknown as { rows: any[] };
    const row = res.rows[0];
    if (!row) return fail('NOT_FOUND', 'Jadwal wawancara tidak ditemukan.', 404);

    // Sinkronkan timeline (INTERVIEW → PASSED/IN_PROGRESS) best-effort.
    try {
      const { syncApplicationTimeline } = await import('@/lib/services/timelineService');
      await syncApplicationTimeline(db, row.applicationId);
    } catch { /* opsional */ }

    return ok(row, 'Jadwal wawancara diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/interviews/[id]');
  }
}
