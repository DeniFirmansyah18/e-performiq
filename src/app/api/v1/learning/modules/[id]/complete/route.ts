import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { completeModule } from '@/lib/services/courseContentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/learning/modules/:id/complete
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);
    const result = await completeModule(db, session.employeeId, ctx.params.id);
    return ok(result, 'Modul ditandai selesai.');
  } catch (err) {
    return problem(err, '/api/v1/learning/modules/[id]/complete');
  }
}
