import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { listDraftQuestions } from '@/lib/services/technicalTestGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/recruitment/assessments/questions/drafts?positionId=...  (HR)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const positionId = req.nextUrl.searchParams.get('positionId');
    if (!positionId) return fail('BAD_REQUEST', 'positionId wajib diisi.', 400);

    const drafts = await listDraftQuestions(db, positionId);
    return ok({ drafts });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/assessments/questions/drafts');
  }
}
