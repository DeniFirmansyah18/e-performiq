import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { getAssessmentScores, listAttemptsForApplication } from '@/lib/services/assessmentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/recruitment/candidates/:id/assessments — ringkasan skor asesmen (HR)
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const [scores, attempts] = await Promise.all([
      getAssessmentScores(db, ctx.params.id),
      listAttemptsForApplication(db, ctx.params.id),
    ]);
    return ok({ applicationId: ctx.params.id, scores, attempts });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/candidates/[id]/assessments');
  }
}
