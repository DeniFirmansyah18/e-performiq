import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { calculateWorkloadSummary } from '@/lib/services/workloadService';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:read');

    const departmentId = req.nextUrl.searchParams.get('departmentId') || undefined;
    const fromDate = req.nextUrl.searchParams.get('fromDate') || undefined;
    const toDate = req.nextUrl.searchParams.get('toDate') || undefined;

    if (departmentId && !UUID_RE.test(departmentId)) {
      return fail('VALIDATION_ERROR', 'departmentId harus berupa UUID.', 400);
    }
    if (fromDate && !DATE_RE.test(fromDate)) {
      return fail('VALIDATION_ERROR', 'fromDate harus berformat YYYY-MM-DD.', 400);
    }
    if (toDate && !DATE_RE.test(toDate)) {
      return fail('VALIDATION_ERROR', 'toDate harus berformat YYYY-MM-DD.', 400);
    }
    if (fromDate && toDate && fromDate > toDate) {
      return fail('VALIDATION_ERROR', 'fromDate tidak boleh setelah toDate.', 400);
    }

    const data = await calculateWorkloadSummary(db, { departmentId, fromDate, toDate });
    return ok(data);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat ringkasan beban kerja',
      status
    );
  }
}
