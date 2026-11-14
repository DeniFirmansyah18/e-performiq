import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import {
  getExpenseClaimById,
  decideExpenseClaim,
} from '@/lib/services/payrollFinanceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KeputusanSchema = z.object({
  keputusan: z.enum(['APPROVED', 'REJECTED']),
  /** Alasan penolakan / catatan. Wajib bila REJECTED. */
  catatan: z.string().max(1000).optional().nullable(),
});

/**
 * GET /api/v1/finance/expense-claims/[id]
 *
 * HR/Finance meninjau satu klaim reimbursement sebelum memutuskan.
 */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:read');

    const klaim = await getExpenseClaimById(ctx.params.id);
    if (!klaim) return fail('NOT_FOUND', 'Klaim reimbursement tidak ditemukan.', 404);
    return ok(klaim);
  } catch (err) {
    return problem(err, '/api/v1/finance/expense-claims/[id]');
  }
}

/**
 * PATCH /api/v1/finance/expense-claims/[id]
 *
 * HR/Finance memutuskan klaim: `APPROVED` (disetujui PENUH sesuai pengajuan)
 * atau `REJECTED` (ditolak, `catatan` WAJIB berisi alasan).
 */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:manage');

    const body = KeputusanSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return fail(
        'VALIDATION_ERROR',
        body.error.issues[0]?.message ?? 'Data keputusan tidak valid.',
        400
      );
    }

    const hasil = await decideExpenseClaim({
      claimId: ctx.params.id,
      keputusan: body.data.keputusan,
      catatan: body.data.catatan ?? null,
      decidedByUserId: session.userId,
      peran: session.role,
    });

    return ok(
      hasil,
      body.data.keputusan === 'APPROVED'
        ? 'Klaim reimbursement disetujui penuh.'
        : 'Klaim reimbursement ditolak.'
    );
  } catch (err) {
    return problem(err, '/api/v1/finance/expense-claims/[id]');
  }
}
