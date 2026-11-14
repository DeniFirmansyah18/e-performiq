import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import {
  listExpenseClaimsForHr,
  decideExpenseClaim,
} from '@/lib/services/payrollFinanceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KeputusanSchema = z.object({
  keputusan: z.enum(['APPROVED', 'REJECTED']),
  /** Nominal yang disetujui; kosong berarti sama dengan pengajuan. */
  disetujui: z.number().positive().optional().nullable(),
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

    const semua = await listExpenseClaimsForHr();
    const klaim = semua.find((k) => k.id === ctx.params.id);
    if (!klaim) return fail('NOT_FOUND', 'Klaim reimbursement tidak ditemukan.', 404);
    return ok(klaim);
  } catch (err) {
    return problem(err, '/api/v1/finance/expense-claims/[id]');
  }
}

/**
 * PATCH /api/v1/finance/expense-claims/[id]
 *
 * HR/Finance memutuskan klaim: `APPROVED` (setujui, nominal boleh disesuaikan)
 * atau `REJECTED` (tolak, `catatan` WAJIB berisi alasan).
 */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:manage');

    const body = KeputusanSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return fail('VALIDATION_ERROR', body.error.issues[0]?.message ?? 'Data keputusan tidak valid.', 400);
    }

    const hasil = await decideExpenseClaim({
      claimId: ctx.params.id,
      keputusan: body.data.keputusan,
      disetujui: body.data.disetujui ?? null,
      catatan: body.data.catatan ?? null,
      decidedByUserId: session.userId,
      peran: session.role,
    });

    return ok(
      hasil,
      body.data.keputusan === 'APPROVED'
        ? 'Klaim reimbursement disetujui.'
        : 'Klaim reimbursement ditolak.'
    );
  } catch (err) {
    return problem(err, '/api/v1/finance/expense-claims/[id]');
  }
}
