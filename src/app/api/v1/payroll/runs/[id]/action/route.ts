import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { approvePayrollRun, markPayrollPaid } from '@/lib/services/payrollService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ActionSchema = z.object({ action: z.enum(['approve', 'pay']) });

// POST /api/v1/payroll/runs/:id/action — approve / mark paid (HR)
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Aksi tidak valid.', 400);

    const okFlag = parsed.data.action === 'approve'
      ? await approvePayrollRun(db, ctx.params.id, session.userId)
      : await markPayrollPaid(db, ctx.params.id);

    if (!okFlag) return fail('BUSINESS_RULE', 'Status run tidak mengizinkan aksi ini.', 422);
    return ok({ runId: ctx.params.id, action: parsed.data.action }, parsed.data.action === 'approve' ? 'Payroll disetujui.' : 'Payroll ditandai dibayar.');
  } catch (err) {
    return problem(err, '/api/v1/payroll/runs/[id]/action');
  }
}
