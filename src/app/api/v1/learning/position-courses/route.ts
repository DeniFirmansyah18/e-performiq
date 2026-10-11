import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import {
  listPositionsWithCourses,
  listCourseOptions,
  addPositionCourse,
  removePositionCourse,
  updatePositionCourse,
} from '@/lib/services/positionCourseMappingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/position-courses — daftar posisi + kursus terpetakan & katalog kursus
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const [positions, courses] = await Promise.all([listPositionsWithCourses(db), listCourseOptions(db)]);
    return ok({ positions, courses });
  } catch (err) {
    return problem(err, '/api/v1/learning/position-courses');
  }
}

// POST /api/v1/learning/position-courses — tambah/perbarui mapping posisi→kursus
// body: { positionId, courseId, isMandatory?, orderIndex?, note? }
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');
    const body = await req.json().catch(() => ({}));
    const positionId = typeof body?.positionId === 'string' ? body.positionId : '';
    const courseId = Number(body?.courseId);
    if (!positionId || !Number.isFinite(courseId)) {
      return fail('BAD_REQUEST', 'positionId dan courseId wajib diisi.', 400);
    }
    const result = await addPositionCourse(db, {
      positionId,
      courseId,
      isMandatory: typeof body?.isMandatory === 'boolean' ? body.isMandatory : undefined,
      orderIndex: Number.isFinite(Number(body?.orderIndex)) ? Number(body.orderIndex) : undefined,
      note: typeof body?.note === 'string' ? body.note : null,
    });
    if (!result.ok) return fail('BAD_REQUEST', result.reason ?? 'Gagal menambah mapping.', 400);
    return ok({ positionId, courseId }, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/learning/position-courses');
  }
}

// PATCH /api/v1/learning/position-courses — perbarui atribut mapping
// body: { positionId, courseId, isMandatory?, orderIndex?, note? }
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');
    const body = await req.json().catch(() => ({}));
    const positionId = typeof body?.positionId === 'string' ? body.positionId : '';
    const courseId = Number(body?.courseId);
    if (!positionId || !Number.isFinite(courseId)) {
      return fail('BAD_REQUEST', 'positionId dan courseId wajib diisi.', 400);
    }
    const result = await updatePositionCourse(db, {
      positionId,
      courseId,
      isMandatory: typeof body?.isMandatory === 'boolean' ? body.isMandatory : undefined,
      orderIndex: Number.isFinite(Number(body?.orderIndex)) ? Number(body.orderIndex) : undefined,
      note: typeof body?.note === 'string' ? body.note : undefined,
    });
    if (!result.ok) return fail('NOT_FOUND', result.reason ?? 'Mapping tidak ditemukan.', 404);
    return ok({ positionId, courseId }, 'Mapping diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/learning/position-courses');
  }
}

// DELETE /api/v1/learning/position-courses?positionId=&courseId=
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');
    const positionId = req.nextUrl.searchParams.get('positionId') ?? '';
    const courseId = Number(req.nextUrl.searchParams.get('courseId'));
    if (!positionId || !Number.isFinite(courseId)) {
      return fail('BAD_REQUEST', 'positionId dan courseId wajib diisi.', 400);
    }
    const result = await removePositionCourse(db, positionId, courseId);
    if (!result.ok) return fail('NOT_FOUND', result.reason ?? 'Mapping tidak ditemukan.', 404);
    return ok({ positionId, courseId }, 'Mapping dihapus.');
  } catch (err) {
    return problem(err, '/api/v1/learning/position-courses');
  }
}
