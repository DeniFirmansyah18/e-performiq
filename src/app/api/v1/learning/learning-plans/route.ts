import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { createPlan, getPlansForEmployee } from '@/lib/services/learningPlanService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PlanSchema = z.object({
  title: z.string().min(3),
  periodId: z.string().uuid().optional(),
});

// POST /api/v1/learning/learning-plans
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);

    const body = await req.json().catch(() => ({}));
    const parsed = PlanSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }
    const plan = await createPlan(db, { employeeId: session.employeeId, title: parsed.data.title, periodId: parsed.data.periodId ?? null });
    return ok(plan, 'Rencana pembelajaran dibuat.');
  } catch (err) {
    return problem(err, '/api/v1/learning/learning-plans');
  }
}

// GET /api/v1/learning/learning-plans (milik sesi)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    if (!session.employeeId) return ok({ plans: [] });
    const plans = await getPlansForEmployee(db, session.employeeId);
    return ok({ plans });
  } catch (err) {
    return problem(err, '/api/v1/learning/learning-plans');
  }
}
