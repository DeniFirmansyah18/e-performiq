import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { addPlanItem } from '@/lib/services/learningPlanService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ItemSchema = z.object({
  competencyId: z.string().uuid().optional(),
  courseId: z.number().int().positive().optional(),
  targetLevel: z.number().int().min(1).max(5).optional(),
});

// POST /api/v1/learning/learning-plans/:id/items
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:write');

    const body = await req.json().catch(() => ({}));
    const parsed = ItemSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }
    const item = await addPlanItem(db, {
      planId: ctx.params.id,
      competencyId: parsed.data.competencyId ?? null,
      courseId: parsed.data.courseId ?? null,
      targetLevel: parsed.data.targetLevel,
    });
    return ok(item, 'Item IDP ditambahkan.');
  } catch (err) {
    return problem(err, '/api/v1/learning/learning-plans/[id]/items');
  }
}
