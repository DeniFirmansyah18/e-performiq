import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as preEmpService from '@/lib/services/preEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/pre-employment/mpp-summary
// PRD §11.2 — Mengambil data realisasi formasi SDM vs kuota budget
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const fiscalYear = parseInt(searchParams.get('fiscal_year') || '2026', 10);

    const summary = await preEmpService.getMppSummaryData(db, fiscalYear);
    return ok(summary);
  } catch (err) {
    return problem(err, '/api/v1/pre-employment/mpp-summary');
  }
}
