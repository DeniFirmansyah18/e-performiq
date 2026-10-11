import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem, parseBody } from '@/lib/api/response';
import {
  getFinalizationRequest,
  submitFinalizationRequest,
} from '@/lib/services/appraisalFinalizationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SubmitSchema = z.object({
  period_id: z.string().optional(),
  note: z.string().max(1000).optional(),
});

// GET /api/v1/performance/finalization?period_id=<uuid>
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);
    const periodId = req.nextUrl.searchParams.get('period_id') ?? undefined;
    const data = await getFinalizationRequest(db, session.employeeId, periodId);
    return ok({ request: data });
  } catch (err) {
    return problem(err, '/api/v1/performance/finalization');
  }
}

// POST /api/v1/performance/finalization
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);
    const body = await parseBody(req, SubmitSchema);
    const data = await submitFinalizationRequest(db, session.employeeId, body.period_id, body.note);
    return ok(data, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/performance/finalization');
  }
}
