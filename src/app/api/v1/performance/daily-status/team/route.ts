import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listTeamStatus } from '@/lib/services/dailyPerformanceService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:approve');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const date = req.nextUrl.searchParams.get('date')
      ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    const items = await listTeamStatus(db, session.employeeId, date);
    return ok({ date, items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat status tim', status);
  }
}
