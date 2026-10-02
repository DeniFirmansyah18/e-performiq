import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { recordDecision } from '@/lib/services/candidateReviewService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DecisionSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED', 'TALENT_POOL', 'PENDING']),
  notes: z.string().max(4000).optional(),
  aiSummary: z.string().max(8000).optional(),
});

// POST /api/v1/recruitment/candidates/:id/decision  (HR)
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = DecisionSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Keputusan tidak valid.', 400);

    const decision = await recordDecision(db, {
      applicationId: ctx.params.id,
      decidedByUserId: session.userId,
      decision: parsed.data.decision,
      notes: parsed.data.notes,
      aiSummary: parsed.data.aiSummary,
    });
    return ok({ applicationId: ctx.params.id, decision }, 'Keputusan tersimpan.');
  } catch (err) {
    if (err instanceof Error && /tidak ditemukan/i.test(err.message)) {
      return fail('NOT_FOUND', err.message, 404);
    }
    return problem(err, '/api/v1/recruitment/candidates/[id]/decision');
  }
}
