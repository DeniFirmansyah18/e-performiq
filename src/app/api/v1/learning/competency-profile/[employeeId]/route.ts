import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ok, problem } from '@/lib/api/response';
import { getCompetencyProfile } from '@/lib/services/competencyService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/competency-profile/:employeeId
export async function GET(req: NextRequest, ctx: { params: { employeeId: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const scope = await resolveVisibleEmployeeIds(db, session);
    assertEmployeeVisible(scope, ctx.params.employeeId);
    const profile = await getCompetencyProfile(db, ctx.params.employeeId);
    return ok(profile);
  } catch (err) {
    return problem(err, '/api/v1/learning/competency-profile/[employeeId]');
  }
}
