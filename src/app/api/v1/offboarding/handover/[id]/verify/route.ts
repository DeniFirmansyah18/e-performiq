import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as offboardingService from '@/lib/services/offboardingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

// PUT /api/v1/offboarding/handover/:id/verify
// PRD §11.2 — Memverifikasi serah terima dokumen/aset LWD
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession(req);
    const { id } = params;

    const verified = await offboardingService.verifyHandoverItem(db, session, id);

    return ok({
      message: 'Item serah terima berhasil diverifikasi & tercatat di audit trail GCG.',
      data: verified,
    });
  } catch (err) {
    return problem(err, `/api/v1/offboarding/handover/${params.id}/verify`);
  }
}
