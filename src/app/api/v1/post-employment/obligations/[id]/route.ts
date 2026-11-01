import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  is_completed: z.boolean(),
  reference_no: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

type Ctx = { params: { id: string } };

/** PATCH /api/v1/post-employment/obligations/[id] — tandai kewajiban selesai. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:manage');
    const body = await parseBody(req, PatchSchema);

    const out = await svc.setObligationCompleted(db, {
      obligationId: ctx.params.id,
      isCompleted: body.is_completed,
      referenceNo: body.reference_no ?? null,
      notes: body.notes ?? null,
      completedBy: body.is_completed ? session.userId : null,
    });

    return ok({
      message: body.is_completed
        ? 'Kewajiban pasca-kerja ditandai selesai.'
        : 'Status kewajiban dikembalikan ke belum selesai.',
      data: out,
    });
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/obligations');
  }
}
