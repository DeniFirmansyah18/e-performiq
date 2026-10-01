import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { getLesson } from '@/lib/services/courseContentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/modules/:id
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const lesson = await getLesson(db, ctx.params.id);
    if (!lesson) return fail('NOT_FOUND', 'Modul tidak ditemukan.', 404);
    return ok(lesson);
  } catch (err) {
    return problem(err, '/api/v1/learning/modules/[id]');
  }
}
