import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { getOnboardingStatus, generateOnboardingProgram, refreshOnboardingStatus } from '@/lib/services/onboardingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/onboarding — status onboarding karyawan yang login
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    if (!session.employeeId) return ok(null);
    const status = await getOnboardingStatus(db, session.employeeId);
    return ok(status);
  } catch (err) {
    return problem(err, '/api/v1/learning/onboarding');
  }
}

// POST /api/v1/learning/onboarding — buat/segarkan program onboarding sendiri
// body: { action: 'generate' | 'refresh' }
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    if (!session.employeeId) return fail('BAD_REQUEST', 'Sesi tidak tertaut karyawan.', 400);
    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'refresh' ? 'refresh' : 'generate';

    if (action === 'refresh') {
      const result = await refreshOnboardingStatus(db, session.employeeId);
      return ok(result, 'Status onboarding diperbarui.');
    }
    const result = await generateOnboardingProgram(db, { employeeId: session.employeeId });
    return ok(result, 'Program onboarding dibuat.');
  } catch (err) {
    return problem(err, '/api/v1/learning/onboarding');
  }
}
