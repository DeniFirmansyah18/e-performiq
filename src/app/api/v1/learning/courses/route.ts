import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { listCourses } from '@/lib/services/learningLmsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/courses?phase=PRE|DURING|POST
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const { searchParams } = new URL(req.url);
    const phase = (searchParams.get('phase') as 'PRE' | 'DURING' | 'POST' | null) ?? undefined;
    const courses = await listCourses(db, phase ?? undefined);
    return ok({ courses, total: courses.length });
  } catch (err) {
    return problem(err, '/api/v1/learning/courses');
  }
}
