import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { listCourses } from '@/lib/services/learningLmsService';
import { createCourse } from '@/lib/services/positionCourseMappingService';

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

// POST /api/v1/learning/courses — tambah kursus katalog manual (+ modul opsional)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return fail('BAD_REQUEST', 'Judul kursus wajib diisi.', 400);
    const result = await createCourse(db, {
      title,
      category: typeof body?.category === 'string' ? body.category : null,
      description: typeof body?.description === 'string' ? body.description : null,
      defaultHours: Number.isFinite(Number(body?.defaultHours)) ? Number(body.defaultHours) : 0,
      isMandatory: body?.isMandatory === true,
      courseCode: typeof body?.courseCode === 'string' ? body.courseCode : null,
      modules: Array.isArray(body?.modules) ? body.modules : [],
    });
    if (!result.ok) return fail('BAD_REQUEST', result.reason ?? 'Gagal membuat kursus.', 400);
    return ok({ courseId: result.courseId, courseCode: result.courseCode }, 'Kursus ditambahkan ke katalog.');
  } catch (err) {
    return problem(err, '/api/v1/learning/courses');
  }
}
