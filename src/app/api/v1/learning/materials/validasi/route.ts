import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { periksaStatisOer, periksaTautanHidup } from '@/lib/services/oerLinkValidator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/learning/materials/validasi?url=...
 *
 * Memeriksa satu tautan materi sebelum disimpan:
 *   - domain wajib penyedia tepercaya
 *   - bukan penyedia berbayar / halaman pembelian
 *   - halaman masih ada dan berisi (bukan 404 / halaman kosong)
 *
 * Dipakai panel agar HR langsung tahu bila tautannya tidak layak, tanpa
 * menunggu gagal saat menyimpan.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');

    const url = req.nextUrl.searchParams.get('url') ?? '';
    if (!url) return fail('VALIDATION_ERROR', 'Parameter url wajib diisi.', 400);

    // Tautan berkas internal (hasil unggahan) selalu sah.
    if (url.startsWith('/api/v1/learning/materials/')) {
      return ok({ url, gratis: true, hidup: true, alasan: null, internal: true });
    }

    const statis = periksaStatisOer(url);
    if (!statis.gratis) {
      return ok({ url, gratis: false, hidup: false, alasan: statis.alasan ?? 'Tautan tidak layak.' });
    }

    const jaringan = await periksaTautanHidup(url);
    return ok({
      url,
      gratis: true,
      hidup: jaringan.hidup,
      alasan: jaringan.alasan,
      internal: false,
    });
  } catch (err) {
    return problem(err, '/api/v1/learning/materials/validasi');
  }
}
