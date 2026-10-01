import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { listModules } from '@/lib/services/courseContentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/courses/:id/modules
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const courseId = Number(ctx.params.id);
    const modules = await listModules(db, courseId, session.employeeId ?? undefined);
    return ok({ modules });
  } catch (err) {
    return problem(err, '/api/v1/learning/courses/[id]/modules');
  }
}
