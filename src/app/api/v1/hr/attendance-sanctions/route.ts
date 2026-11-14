import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { daftarRekomendasiSanksiAbsensi } from '@/lib/services/absensiSanksiService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/hr/attendance-sanctions?month=YYYY-MM
// Rekomendasi sanksi absensi otomatis untuk HR (kategori ABSENSI).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'disciplinary:manage');

    const rawMonth = req.nextUrl.searchParams.get('month') ?? (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();
    if (!/^\d{4}-\d{2}$/.test(rawMonth)) {
      return fail('VALIDATION_ERROR', "month wajib berformat 'YYYY-MM'.", 400);
    }

    const items = await daftarRekomendasiSanksiAbsensi(db, rawMonth);
    return ok({ month: rawMonth, items, total: items.length });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat rekomendasi sanksi absensi',
      status,
    );
  }
}
