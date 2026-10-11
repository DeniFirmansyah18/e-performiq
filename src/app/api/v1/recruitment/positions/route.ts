import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { listPositions, createPosition } from '@/lib/services/orgStructureService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  departmentId: z.string().uuid(),
  positionTitle: z.string().min(2).max(200),
  jobGrade: z.string().max(20).nullable().optional(),
  competencyDictionary: z.unknown().optional(),
});

// GET /api/v1/recruitment/positions?departmentId= — daftar posisi (HR/BOD/Auditor)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const departmentId = req.nextUrl.searchParams.get('departmentId') ?? undefined;
    const positions = await listPositions(db, departmentId);
    return ok({ positions });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/positions');
  }
}

// POST /api/v1/recruitment/positions — tambah posisi (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data posisi tidak valid.', 400);

    const result = await createPosition(db, parsed.data);
    if (!result.ok) return fail('BUSINESS_RULE', result.reason, 409);
    return ok({ id: result.id }, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/positions');
  }
}
