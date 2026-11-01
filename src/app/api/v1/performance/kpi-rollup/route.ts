import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { fail, ok, problem, parseBody } from '@/lib/api/response';
import { rollupEmployeePeriod } from '@/lib/services/kpiRollupService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RollupSchema = z.object({
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  period_id: z.string().uuid('period_id harus UUID'),
});

// POST /api/v1/performance/kpi-rollup
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    const body = await parseBody(req, RollupSchema);
    const result = await rollupEmployeePeriod(db, session, body.employee_id, body.period_id);
    return ok(
      result,
      `Realisasi harian ditarik ke ${result.updated} KPI periode.`,
    );
  } catch (err) {
    return problem(err, '/api/v1/performance/kpi-rollup');
  }
}
