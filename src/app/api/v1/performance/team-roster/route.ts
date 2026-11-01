import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import { selectRoster } from '@/lib/repositories/rosterRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/team-roster
// Daftar bawahan sesuai scope manajer + ringkasan appraisal & KPI terbarunya.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('period_id') ?? undefined;
    const members = await selectRoster(db, session, periodId);
    return ok({ members, total: members.length });
  } catch (err) {
    return problem(err, '/api/v1/performance/team-roster');
  }
}
