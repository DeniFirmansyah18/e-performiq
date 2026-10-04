import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { getApplicationDetail } from '@/lib/services/candidateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/recruitment/candidates/:id/detail — detail lengkap pelamar (HR)
// :id = applicationId.
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const detail = await getApplicationDetail(db, ctx.params.id);
    if (!detail) return fail('NOT_FOUND', 'Lamaran tidak ditemukan.', 404);
    return ok(detail);
  } catch (err) {
    return problem(err, '/api/v1/recruitment/candidates/[id]/detail');
  }
}
