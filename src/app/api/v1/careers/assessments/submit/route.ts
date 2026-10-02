import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { getCandidateSession } from '@/lib/auth/candidateSession';
import { resolveCandidateContext } from '@/lib/services/candidateContext';
import { submitAttempt } from '@/lib/services/assessmentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SubmitSchema = z.object({
  templateId: z.string().uuid(),
  responses: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        answerKey: z.string().max(20).optional(),
        answerText: z.string().max(8000).optional(),
      }),
    )
    .max(200),
});

// POST /api/v1/careers/assessments/submit — kirim jawaban & hitung skor
export async function POST(req: NextRequest) {
  try {
    const session = await getCandidateSession(req);
    const ctx = await resolveCandidateContext(db, session);
    if (!ctx) return fail('NOT_FOUND', 'Tidak ada lamaran tertaut pada akun ini.', 404);

    const body = await req.json().catch(() => ({}));
    const parsed = SubmitSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Jawaban tidak valid.', 400);

    const result = await submitAttempt(db, {
      applicationId: ctx.applicationId,
      templateId: parsed.data.templateId,
      responses: parsed.data.responses,
    });
    return ok(result, 'Jawaban tersimpan. Terima kasih!');
  } catch (err) {
    if (err instanceof Error && /tidak ditemukan/i.test(err.message)) {
      return fail('NOT_FOUND', err.message, 404);
    }
    return problem(err, '/api/v1/careers/assessments/submit');
  }
}
