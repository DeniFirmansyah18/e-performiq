import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { changeEmploymentStatus } from '@/lib/services/employmentStatusService';

const BodySchema = z.object({
  newStatus: z.enum(['PROBATION', 'PKWT', 'PKWTT', 'TETAP', 'RESIGNED', 'RETIRED']),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(5),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:manage');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await changeEmploymentStatus(db, {
      employeeId: params.id,
      newStatus: parsed.data.newStatus,
      effectiveDate: parsed.data.effectiveDate,
      reason: parsed.data.reason,
      decidedBy: session.userId,
    });
    return ok(row, 'Status kepegawaian diperbarui.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengubah status',
      status,
    );
  }
}
