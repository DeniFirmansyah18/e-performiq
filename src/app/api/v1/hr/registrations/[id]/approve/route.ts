import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem, parseBody } from '@/lib/api/response';
import { approveRegistration } from '@/lib/services/employeeRegistrationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ApproveSchema = z.object({
  departmentId: z.string().uuid('departmentId harus UUID valid'),
  positionId: z.string().uuid('positionId harus UUID valid'),
});

// POST /api/v1/hr/registrations/:id/approve — setujui registrasi (HR).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const { departmentId, positionId } = await parseBody(req, ApproveSchema);
    const result = await approveRegistration(db, ctx.params.id, {
      approvedBy: session.userId,
      departmentId,
      positionId,
    });
    return ok(result, 'Registrasi disetujui. Akun karyawan aktif.');
  } catch (err) {
    if (err instanceof Error && /tidak ditemukan/i.test(err.message)) {
      return fail('NOT_FOUND', err.message, 404);
    }
    return problem(err, '/api/v1/hr/registrations/[id]/approve');
  }
}
