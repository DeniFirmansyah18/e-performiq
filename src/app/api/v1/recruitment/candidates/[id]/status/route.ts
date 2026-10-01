import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { updateApplicationStatus } from '@/lib/services/candidateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const StatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED']),
});

// PATCH /api/v1/recruitment/candidates/:id/status  (HR)
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = StatusSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Status tidak valid.', 400);
    const updated = await updateApplicationStatus(db, ctx.params.id, parsed.data.status);
    if (!updated) return fail('NOT_FOUND', 'Lamaran tidak ditemukan.', 404);
    return ok(updated, 'Status diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/candidates/[id]/status');
  }
}
