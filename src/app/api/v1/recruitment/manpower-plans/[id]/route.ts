import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { updateManpowerPlan, deleteManpowerPlan } from '@/lib/services/manpowerPlanService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  fiscalYear: z.number().int().min(2000).max(2100).optional(),
  approvedQuota: z.number().int().min(0).max(100000).optional(),
  allocatedBudget: z.number().min(0).optional(),
  utilizedBudget: z.number().min(0).optional(),
  hiredCount: z.number().int().min(0).optional(),
  /** Atasan langsung (People Manager); null berarti tidak diubah. */
  managerId: z.string().uuid().nullable().optional(),
});

// PATCH /api/v1/recruitment/manpower-plans/:id — ubah kuota/budget MPP (HR)
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data MPP tidak valid.', 400);
    if (Object.keys(parsed.data).length === 0) {
      return fail('VALIDATION_ERROR', 'Tidak ada field yang diubah.', 400);
    }

    const result = await updateManpowerPlan(db, ctx.params.id, parsed.data);
    if (!result.ok) return fail(result.notFound ? 'NOT_FOUND' : 'BUSINESS_RULE', result.reason, result.notFound ? 404 : 409);
    return ok({ id: result.id }, 'MPP diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/manpower-plans/[id]');
  }
}

// DELETE /api/v1/recruitment/manpower-plans/:id — hapus MPP (HR)
export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const result = await deleteManpowerPlan(db, ctx.params.id);
    if (!result.ok) return fail(result.notFound ? 'NOT_FOUND' : 'BUSINESS_RULE', result.reason, result.notFound ? 404 : 409);
    return ok({ id: result.id }, 'MPP dihapus.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/manpower-plans/[id]');
  }
}
