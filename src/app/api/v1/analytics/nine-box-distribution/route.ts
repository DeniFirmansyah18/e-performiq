import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as analyticsService from '@/lib/services/analyticsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/analytics/nine-box-distribution
// PRD §11.2 — Distribusi demografi talent grid 9-Box korporasi
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const periodCode = searchParams.get('period_code') || '2026-Q3';

    const data = await analyticsService.getNineBoxDistributionData(db, periodCode);
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/analytics/nine-box-distribution');
  }
}
