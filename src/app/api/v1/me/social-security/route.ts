import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { buildCard, getSocialSecurity } from '@/lib/services/socialSecurityService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'social_security:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const card = await getSocialSecurity(db, session.employeeId);
    // "Belum terdaftar" bukan "tidak ditemukan": jawab 200 dengan
    // registered=false agar browser tidak mencatat 404 palsu di konsol.
    return ok(buildCard(card));
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat kartu BPJS', status);
  }
}
