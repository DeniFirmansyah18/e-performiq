import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ScoreSchema = z.object({
  applicationId: z.string().uuid(),
  score: z.number().min(0).max(100),
  notes: z.string().max(4000).optional(),
  interviewId: z.string().uuid().optional(),
});

// POST /api/v1/recruitment/interviews/score — input skor wawancara (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = ScoreSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Skor tidak valid (0–100).', 400);
    const { applicationId, score, notes, interviewId } = parsed.data;

    // 1) Simpan skor pada jadwal wawancara (bila ada).
    if (interviewId) {
      await db.execute(sql`
        UPDATE interview_schedules
           SET score = ${score}, notes = ${notes ?? null}, status = 'DONE'
         WHERE id = ${interviewId}::uuid AND application_id = ${applicationId}::uuid
      `);
    } else {
      await db.execute(sql`
        UPDATE interview_schedules
           SET score = ${score}, notes = ${notes ?? null}, status = 'DONE'
         WHERE application_id = ${applicationId}::uuid
           AND id = (SELECT id FROM interview_schedules WHERE application_id = ${applicationId}::uuid
                      ORDER BY scheduled_at DESC LIMIT 1)
      `);
    }

    // 2) Set skor komponen wawancara (attempt INTERVIEW) + agregat 30/40/30.
    const { setInterviewScore } = await import('@/lib/services/assessmentService');
    await setInterviewScore(db, applicationId, score, notes);

    return ok({ applicationId, score }, 'Skor wawancara tersimpan.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/interviews/score');
  }
}
