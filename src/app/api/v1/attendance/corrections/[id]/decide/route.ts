import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { decideCorrection } from '@/lib/services/attendanceCorrectionService';

const BodySchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(500).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:correct');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Keputusan tidak valid.', 400);

    const row = await decideCorrection(db, {
      id: params.id, deciderId: session.userId,
      decision: parsed.data.decision, note: parsed.data.note,
    });
    return ok(row, 'Keputusan koreksi tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memutuskan koreksi',
      status,
    );
  }
}
