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
  is_returned: z.boolean(),
});

type Ctx = { params: { id: string } };

/** PATCH /api/v1/post-employment/clearance/asset/[id] — tandai aset kembali. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:manage');
    const body = await parseBody(req, PatchSchema);

    const out = await svc.setAssetReturned(
      db,
      ctx.params.id,
      body.is_returned,
      session.userId
    );
    return ok({
      message: body.is_returned
        ? 'Aset ditandai sudah dikembalikan.'
        : 'Aset ditandai belum dikembalikan.',
      data: out,
    });
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/clearance/asset');
  }
}

/** DELETE /api/v1/post-employment/clearance/asset/[id] — hapus aset. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:manage');

    await svc.removeClearanceAsset(db, ctx.params.id);
    return ok({ message: 'Aset dihapus dari checklist serah terima.' });
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/clearance/asset');
  }
}
