import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { getCandidateReviewWithAi, saveAiSummary } from '@/lib/services/candidateReviewService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/recruitment/candidates/:id/review  (HR)
// Mengembalikan kartu review lengkap + ringkasan advisory AI (fallback aman).
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const result = await getCandidateReviewWithAi(db, ctx.params.id);
    if (!result) return fail('NOT_FOUND', 'Lamaran tidak ditemukan.', 404);
    // Simpan ringkasan agar tidak dihitung ulang tiap buka (best-effort).
    if (result.aiConfigured) await saveAiSummary(db, ctx.params.id, result.aiSummary);
    return ok({ ...result.review, aiSummary: result.aiSummary, aiConfigured: result.aiConfigured });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/candidates/[id]/review');
  }
}
