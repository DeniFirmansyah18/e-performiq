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
  // Skor tunggal (opsional bila rubrik diberikan; rubrik menurunkannya otomatis).
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(4000).optional(),
  interviewId: z.string().uuid().optional(),
  // Rubrik 7 kriteria (skala 1..5). Bila ada, kompositnya jadi skor wawancara.
  rubric: z.object({
    technical_skill: z.number().min(1).max(5).nullable().optional(),
    problem_solving: z.number().min(1).max(5).nullable().optional(),
    communication: z.number().min(1).max(5).nullable().optional(),
    collaboration: z.number().min(1).max(5).nullable().optional(),
    motivation: z.number().min(1).max(5).nullable().optional(),
    leadership: z.number().min(1).max(5).nullable().optional(),
    professionalism: z.number().min(1).max(5).nullable().optional(),
  }).optional(),
  strengths: z.string().max(4000).optional(),
  concerns: z.string().max(4000).optional(),
});

// POST /api/v1/recruitment/interviews/score — input skor wawancara (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = ScoreSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Skor/rubrik tidak valid.', 400);
    const { applicationId, interviewId, rubric, strengths, concerns } = parsed.data;
    const notes = parsed.data.notes;

    // Rubrik (bila ada) → simpan + turunkan skor komposit (0..100).
    const { saveInterviewEvaluation, rubricToComposite } = await import('@/lib/services/interviewEvaluationService');
    let effectiveScore: number | null = parsed.data.score ?? null;
    if (rubric) {
      const evaluatorId = (session as { user?: { id?: string } })?.user?.id ?? null;
      const ev = await saveInterviewEvaluation(db, {
        applicationId,
        interviewId: interviewId ?? null,
        evaluatorUserId: evaluatorId,
        scores: rubric,
        strengths: strengths ?? null,
        concerns: concerns ?? null,
        notes: notes ?? null,
      });
      if (ev.compositeScore != null) effectiveScore = ev.compositeScore;
    }
    if (effectiveScore == null && rubric) {
      effectiveScore = rubricToComposite(rubric);
    }
    if (effectiveScore == null) return fail('VALIDATION_ERROR', 'Skor wawancara diperlukan (skor atau rubrik).', 400);
    const score = effectiveScore;

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
