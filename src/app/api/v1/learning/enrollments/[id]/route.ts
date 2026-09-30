import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { recordProgress, completeCourse } from '@/lib/services/learningLmsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  progressPct: z.number().min(0).max(100).optional(),
  minutes: z.number().int().min(0).optional(),
  complete: z.boolean().optional(),
});

// PATCH /api/v1/learning/enrollments/:id  (id = moodle_course_id pada enrollment milik sesi)
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);

    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const courseId = Number(ctx.params.id);
    if (!Number.isFinite(courseId)) return fail('VALIDATION_ERROR', 'ID kursus tidak valid', 400);

    if (parsed.data.complete) {
      const result = await completeCourse(db, session.employeeId, courseId);
      return ok(result, 'Kursus diselesaikan.');
    }

    const result = await recordProgress(db, session.employeeId, courseId, parsed.data.progressPct ?? 0, parsed.data.minutes ?? 0);
    return ok(result, 'Progres diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/learning/enrollments/[id]');
  }
}
