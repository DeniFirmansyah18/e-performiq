import { NextRequest } from 'next/server';
import { getObject } from '@/lib/storage/fileStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/learning/materials/<key...>
 *
 * Menyajikan kembali materi kursus yang diunggah HR. Berkas disimpan di object
 * storage (atau disk lokal bila S3 tidak tersedia) dan di-stream di sini agar
 * tautannya stabil dan tidak membocorkan path penyimpanan.
 */
export async function GET(_req: NextRequest, ctx: { params: { key: string[] } }) {
  try {
    const key = (ctx.params.key ?? []).map(decodeURIComponent).join('/');
    if (!key) return new Response('Materi tidak ditemukan.', { status: 404 });

    const obj = await getObject(key);
    if (!obj) return new Response('Materi tidak ditemukan.', { status: 404 });

    return new Response(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        'Content-Type': obj.contentType || 'application/octet-stream',
        // Materi boleh diberi ETag-based cache singkat; tetap privat.
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return new Response('Gagal memuat materi.', { status: 500 });
  }
}
