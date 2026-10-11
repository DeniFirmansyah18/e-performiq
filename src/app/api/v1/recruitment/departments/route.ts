import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { listDepartments, createDepartment } from '@/lib/services/orgStructureService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  departmentName: z.string().min(2).max(200),
  divisionName: z.string().max(200).nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
});

// GET /api/v1/recruitment/departments — daftar departemen (HR/BOD/Auditor)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    const departments = await listDepartments(db);
    return ok({ departments });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/departments');
  }
}

// POST /api/v1/recruitment/departments — tambah departemen (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data departemen tidak valid.', 400);

    const result = await createDepartment(db, parsed.data);
    if (!result.ok) return fail('BUSINESS_RULE', result.reason, 409);
    return ok({ id: result.id }, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/departments');
  }
}
