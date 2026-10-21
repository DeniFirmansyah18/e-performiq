import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listByStatus, type EmploymentStatus } from '@/lib/services/employmentStatusService';

const VALID: EmploymentStatus[] = ['PROBATION', 'PKWT', 'PKWTT', 'TETAP', 'RESIGNED', 'RETIRED'];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:read');

    const raw = req.nextUrl.searchParams.get('status');
    if (raw && !VALID.includes(raw as EmploymentStatus)) {
      return fail('VALIDATION_ERROR', `Status '${raw}' tidak dikenal.`, 400);
    }
    const items = await listByStatus(db, (raw as EmploymentStatus) ?? undefined);
    return ok({ items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat daftar status', status);
  }
}
