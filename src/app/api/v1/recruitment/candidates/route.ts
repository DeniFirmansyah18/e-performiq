import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { listCandidates } from '@/lib/services/candidateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/recruitment/candidates  (HR)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const candidates = await listCandidates(db);
    return ok({ candidates });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/candidates');
  }
}
