import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listLadder, readiness } from '@/lib/services/careerLadderService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'career:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const [steps, score] = await Promise.all([
      listLadder(db, session.employeeId),
      readiness(db, session.employeeId),
    ]);
    return ok({ steps, readiness: score });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat tangga karir', status);
  }
}
