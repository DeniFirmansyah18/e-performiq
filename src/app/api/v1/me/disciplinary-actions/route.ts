import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listDisciplinary } from '@/lib/services/disciplinaryService';
import { hitungPoinPelanggaran } from '@/lib/services/disciplinaryPoints';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const items = await listDisciplinary(db, session.employeeId);
    // Pegawai melihat poin pelanggaran yang masih berlaku beserta ambangnya.
    const ringkasan = hitungPoinPelanggaran(items as any[]);
    return ok({ items, ringkasanPoin: ringkasan });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat sanksi', status);
  }
}
