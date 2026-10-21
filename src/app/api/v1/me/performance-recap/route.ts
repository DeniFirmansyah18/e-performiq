import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getRecap } from '@/lib/services/dailyPerformanceService';

const PERIODS = ['daily', 'monthly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const raw = req.nextUrl.searchParams.get('period') ?? 'monthly';
    if (!PERIODS.includes(raw as Period)) {
      return fail('VALIDATION_ERROR', `Period harus salah satu: ${PERIODS.join(', ')}.`, 400);
    }
    const anchor = req.nextUrl.searchParams.get('anchor') ?? undefined;
    if (anchor && !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
      return fail('VALIDATION_ERROR', 'anchor harus berformat YYYY-MM-DD.', 400);
    }

    const recap = await getRecap(db, session.employeeId, raw as Period, anchor);
    return ok(recap);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat rekap', status);
  }
}
