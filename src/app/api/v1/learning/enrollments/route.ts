import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { enrollLocal } from '@/lib/services/learningLmsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EnrollSchema = z.object({ courseId: z.number().int().positive() });

// POST /api/v1/learning/enrollments  { courseId }
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);

    const body = await req.json().catch(() => ({}));
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'courseId tidak valid', 400);
    }

    const enrollment = await enrollLocal(db, session.employeeId, parsed.data.courseId);
    return ok(enrollment, 'Pendaftaran kursus berhasil.');
  } catch (err) {
    return problem(err, '/api/v1/learning/enrollments');
  }
}
