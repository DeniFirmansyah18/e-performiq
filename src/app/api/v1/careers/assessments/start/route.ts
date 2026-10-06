import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { getCandidateSession } from '@/lib/auth/candidateSession';
import { resolveCandidateContext } from '@/lib/services/candidateContext';
import { startAttempt } from '@/lib/services/assessmentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const StartSchema = z.object({
  templateId: z.string().uuid().optional(),
  type: z.enum(['PSYCHOMETRIC', 'TECHNICAL']).optional(),
});

// POST /api/v1/careers/assessments/start — mulai/lanjutkan attempt
export async function POST(req: NextRequest) {
  try {
    const session = await getCandidateSession(req);
    const ctx = await resolveCandidateContext(db, session);
    if (!ctx) return fail('NOT_FOUND', 'Tidak ada lamaran tertaut pada akun ini.', 404);

    const body = await req.json().catch(() => ({}));
    const parsed = StartSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Parameter tes tidak valid.', 400);

    // Resolusi template: eksplisit via id, atau via tipe.
    let templateId = parsed.data.templateId;
    if (!templateId && parsed.data.type) {
      const { getTemplateForType } = await import('@/lib/services/assessmentService');
      const tpl = await getTemplateForType(db, parsed.data.type);
      if (!tpl) return fail('NOT_FOUND', 'Template asesmen tidak tersedia.', 404);
      templateId = tpl.id;
    }
    if (!templateId) return fail('BAD_REQUEST', 'Sebutkan templateId atau type.', 400);

    const attempt = await startAttempt(db, {
      applicationId: ctx.applicationId,
      candidateId: ctx.candidateId,
      templateId,
    });
    return ok(attempt);
  } catch (err) {
    // Error domain (mis. template tak ditemukan) → 422; lainnya → problem().
    if (err instanceof Error && /tidak ditemukan/i.test(err.message)) {
      return fail('NOT_FOUND', err.message, 404);
    }
    if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 409) {
      return fail('CONFLICT', err.message, 409);
    }
    return problem(err, '/api/v1/careers/assessments/start');
  }
}
