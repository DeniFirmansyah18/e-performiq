import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { getPostEmploymentSummary } from '@/lib/services/dashboardAggregationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/dashboard/post-employment — ringkasan pasca-kerja (exit, cuti, LCI)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'analytics:read');
    const data = await getPostEmploymentSummary(db);
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/dashboard/post-employment');
  }
}
