import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { getOnboardingMilestones } from '@/lib/services/preEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/pre-employment/probation — daftar evaluasi probation (30-60-90) seluruh karyawan
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const milestones = await getOnboardingMilestones(db);
    return ok({ milestones });
  } catch (err) {
    return problem(err, '/api/v1/pre-employment/probation');
  }
}
