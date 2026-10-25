import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listEmployeesForHr } from '@/lib/services/hrEmployeeDirectoryService';

/**
 * Direktori pegawai untuk Command Center HRD (Narasi 3 pilar 7).
 *
 * Berbeda dari `/api/v1/hr/employees` (picker rekrutmen yang mensyaratkan
 * `recruitment:manage`), endpoint ini memakai `employment:read` agar BOD dan
 * AUDITOR dapat memakai direktori. Peran EMPLOYEE ditolak eksplisit: ini
 * halaman HR, dan direktori bukan sarana enumerasi pegawai bagi semua orang.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:read');

    if (session.role === 'EMPLOYEE') {
      return fail('FORBIDDEN', 'Direktori pegawai hanya untuk peran HR.', 403);
    }

    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
    const employees = await listEmployeesForHr(db, { includeInactive });
    return ok({ employees, total: employees.length });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat direktori pegawai',
      status
    );
  }
}