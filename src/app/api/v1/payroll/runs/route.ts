import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { generatePayrollRun, listPayrollRuns, listPayrollItems } from '@/lib/services/payrollService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GenerateSchema = z.object({
  periodCode: z.string().regex(/^\d{4}-\d{2}$/, 'periodCode harus format YYYY-MM'),
  periodStart: z.string().min(8).max(10),
  periodEnd: z.string().min(8).max(10),
  isThrMonth: z.boolean().optional(),
});

// GET /api/v1/payroll/runs — daftar run payroll (HR)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:read');
    const runId = req.nextUrl.searchParams.get('runId');
    if (runId) {
      const items = await listPayrollItems(db, runId);
      return ok({ items });
    }
    const runs = await listPayrollRuns(db);
    return ok({ runs });
  } catch (err) {
    return problem(err, '/api/v1/payroll/runs');
  }
}

// POST /api/v1/payroll/runs — buat/regenerate run payroll (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data periode tidak valid.', 400);

    const result = await generatePayrollRun(db, { ...parsed.data, createdBy: session.userId });
    return ok(result, 'Run payroll berhasil dibuat.');
  } catch (err) {
    return problem(err, '/api/v1/payroll/runs');
  }
}
