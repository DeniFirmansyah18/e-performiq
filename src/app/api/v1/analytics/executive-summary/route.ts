import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { getExecutiveSummary } from '@/lib/services/analyticsSummaryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/analytics/executive-summary
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'analytics:read');
    const { searchParams } = new URL(req.url);
    const periodCode = searchParams.get('period_code') ?? undefined;

    const data = await getExecutiveSummary(db, periodCode);
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/analytics/executive-summary');
  }
}
