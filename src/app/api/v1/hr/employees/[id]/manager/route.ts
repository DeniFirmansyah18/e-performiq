import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { setEmployeeManager } from '@/lib/services/managerAssignmentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ manager_id: z.string().uuid().nullable() }).strict();

// PATCH /api/v1/hr/employees/[id]/manager — tetapkan atasan langsung (HR).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Data atasan tidak valid.', 400);
    const result = await setEmployeeManager(db, params.id, parsed.data.manager_id, session.userId);
    return ok(result, 'Atasan langsung diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/hr/employees/[id]/manager');
  }
}
