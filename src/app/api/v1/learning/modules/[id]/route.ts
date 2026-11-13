import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { getLesson } from '@/lib/services/courseContentService';
import { ubahModul } from '@/lib/services/learningLmsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UbahModulSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  contentUrl: z.string().max(500).nullable().optional(),
  contentBody: z.string().max(8000).nullable().optional(),
  contentType: z.enum(['TEXT', 'VIDEO', 'PDF', 'QUIZ']).optional(),
});

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

// PATCH /api/v1/learning/modules/:id — HR menyesuaikan materi kursus
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');
    const moduleId = Number(ctx.params.id);
    if (!Number.isFinite(moduleId)) return fail('BAD_REQUEST', 'ID modul tidak valid.', 400);

    const parsed = UbahModulSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Data materi tidak valid.', 400);

    await ubahModul(db, moduleId, parsed.data);
    return ok({ moduleId }, 'Materi diperbarui.');
  } catch (err) {
    // Validasi tautan (domain tepercaya / bukan berbayar) → 400 dengan pesan jelas.
    if (/tepercaya|berbayar|tidak valid/i.test(String((err as Error)?.message ?? ''))) {
      return fail('VALIDATION_ERROR', String((err as Error).message), 400);
    }
    return problem(err, '/api/v1/learning/modules/[id]');
  }
}
