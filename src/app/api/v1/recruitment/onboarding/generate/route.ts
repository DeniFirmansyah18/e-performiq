import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { generateOnboardingProgram, getOnboardingStatus, refreshOnboardingStatus } from '@/lib/services/onboardingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GenerateSchema = z.object({
  employeeId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
});

// POST /api/v1/recruitment/onboarding/generate  (HR) — buat program onboarding karyawan baru
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'employeeId wajib diisi.', 400);

    const result = await generateOnboardingProgram(db, {
      employeeId: parsed.data.employeeId,
      applicationId: parsed.data.applicationId ?? null,
    });
    const status = await refreshOnboardingStatus(db, parsed.data.employeeId);
    const detail = await getOnboardingStatus(db, parsed.data.employeeId);
    return ok({ ...result, ...status, detail }, 'Program onboarding dibuat.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/onboarding/generate');
  }
}

// GET /api/v1/recruitment/onboarding/generate?employeeId=...  (HR)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const employeeId = req.nextUrl.searchParams.get('employeeId');
    if (!employeeId) return fail('BAD_REQUEST', 'employeeId wajib diisi.', 400);
    const detail = await getOnboardingStatus(db, employeeId);
    return ok(detail);
  } catch (err) {
    return problem(err, '/api/v1/recruitment/onboarding/generate');
  }
}
