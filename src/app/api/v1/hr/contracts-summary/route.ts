import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getContractsSummary, todayInJakarta } from '@/lib/services/contractService';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:read');

    const refDate = req.nextUrl.searchParams.get('refDate') || todayInJakarta();
    if (!DATE_RE.test(refDate)) {
      return fail('VALIDATION_ERROR', 'refDate harus berformat YYYY-MM-DD.', 400);
    }

    const data = await getContractsSummary(db, refDate);
    return ok(data);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat ringkasan kontrak PKWT',
      status
    );
  }
}
