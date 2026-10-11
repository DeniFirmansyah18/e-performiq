import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import {
  listManpowerPlans,
  getMppReference,
  createManpowerPlan,
} from '@/lib/services/manpowerPlanService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  fiscalYear: z.number().int().min(2000).max(2100),
  approvedQuota: z.number().int().min(0).max(100000),
  allocatedBudget: z.number().min(0),
  utilizedBudget: z.number().min(0).optional(),
  hiredCount: z.number().int().min(0).optional(),
});

// GET /api/v1/recruitment/manpower-plans — daftar MPP + referensi form (HR/BOD/Auditor)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const yearParam = req.nextUrl.searchParams.get('fiscalYear');
    const fiscalYear = yearParam ? Number(yearParam) : undefined;
    const [plans, reference] = await Promise.all([
      listManpowerPlans(db, Number.isFinite(fiscalYear) ? fiscalYear : undefined),
      getMppReference(db),
    ]);
    return ok({ plans, ...reference });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/manpower-plans');
  }
}

// POST /api/v1/recruitment/manpower-plans — tambah MPP (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data MPP tidak valid.', 400);

    const d = parsed.data;
    if (d.utilizedBudget != null && d.utilizedBudget > d.allocatedBudget) {
      return fail('VALIDATION_ERROR', 'Budget terpakai tidak boleh melebihi budget yang dialokasikan.', 400);
    }

    const result = await createManpowerPlan(db, d);
    if (!result.ok) return fail('BUSINESS_RULE', result.reason, 409);
    return ok({ id: result.id }, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/manpower-plans');
  }
}
