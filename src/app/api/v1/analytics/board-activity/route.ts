import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getBoardActivityAnalytics } from '@/lib/services/boardActivityAnalyticsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Daftar tipe valid; dicek di route agar tidak error cast enum di SQL. */
const EVENT_TYPES = [
  'ATTENDANCE', 'KPI_DAILY', 'DPI_STATUS', 'LEAVE', 'OVERTIME',
  'TRAINING', 'LETTER', 'DISCIPLINARY', 'RECOGNITION', 'CAREER',
];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const sp = req.nextUrl.searchParams;
    const fromDate = sp.get('fromDate') || undefined;
    const toDate = sp.get('toDate') || undefined;
    const eventType = sp.get('eventType') || undefined;
    const departmentId = sp.get('departmentId') || undefined;
    const search = sp.get('search') || undefined;

    if (fromDate && !DATE_RE.test(fromDate)) {
      return fail('VALIDATION_ERROR', 'fromDate harus berformat YYYY-MM-DD.', 400);
    }
    if (toDate && !DATE_RE.test(toDate)) {
      return fail('VALIDATION_ERROR', 'toDate harus berformat YYYY-MM-DD.', 400);
    }
    if (fromDate && toDate && fromDate > toDate) {
      return fail('VALIDATION_ERROR', 'fromDate tidak boleh setelah toDate.', 400);
    }
    if (eventType && !EVENT_TYPES.includes(eventType)) {
      return fail('VALIDATION_ERROR', `Tipe event '${eventType}' tidak dikenal.`, 400);
    }
    if (departmentId && !UUID_RE.test(departmentId)) {
      return fail('VALIDATION_ERROR', 'departmentId harus berupa UUID.', 400);
    }

    const data = await getBoardActivityAnalytics(db, {
      fromDate,
      toDate,
      eventType,
      departmentId,
      search,
    });
    return ok(data);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat aktivitas Boardroom',
      status
    );
  }
}
