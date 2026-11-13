import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { buildStorageKey, putObject } from '@/lib/storage/fileStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Batas ukuran materi kursus (keputusan produk: 25 MB). */
const MAX_SIZE = 25 * 1024 * 1024;

/** Jenis berkas yang diterima sebagai materi kursus. */
const TIPE_DIIZINKAN = [
  'application/pdf',
  'video/mp4',
  'video/webm',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Ekstensi cadangan bila browser tidak mengirim MIME yang tepat. */
const EKSTENSI_DIIZINKAN = ['pdf', 'mp4', 'webm', 'png', 'jpg', 'jpeg', 'pptx', 'docx'];

function aman(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

/**
 * POST /api/v1/learning/materials/upload  (multipart/form-data, field `file`)
 *
 * Menyimpan materi kursus (PDF, video, gambar, slide/dokumen) ke object
 * storage dan mengembalikan `url` yang siap dipakai sebagai `content_url`
 * modul. Berkas tidak disimpan di database.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');

    const form = await req.formData().catch(() => null);
    if (!form) return fail('VALIDATION_ERROR', 'Formulir unggahan tidak valid.', 400);

    const file = form.get('file');
    if (!(file instanceof File)) return fail('VALIDATION_ERROR', 'Berkas materi wajib dipilih.', 400);

    if (file.size === 0) return fail('VALIDATION_ERROR', 'Berkas kosong.', 400);
    if (file.size > MAX_SIZE) {
      return fail('VALIDATION_ERROR', `Ukuran berkas maksimal ${Math.round(MAX_SIZE / 1024 / 1024)} MB.`, 400);
    }

    const nama = aman(file.name || 'materi');
    const ekstensi = (nama.split('.').pop() ?? '').toLowerCase();
    const mime = (file.type || '').toLowerCase();
    const tipeOk = TIPE_DIIZINKAN.includes(mime) || EKSTENSI_DIIZINKAN.includes(ekstensi);
    if (!tipeOk) {
      return fail(
        'VALIDATION_ERROR',
        'Jenis berkas tidak didukung. Gunakan PDF, MP4/WebM, PNG/JPG, PPTX, atau DOCX.',
        400
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = buildStorageKey('learning/materials', `${Date.now()}-${nama}`);
    const simpan = await putObject(key, buffer, mime || 'application/octet-stream');

    return ok(
      {
        url: `/api/v1/learning/materials/${encodeURIComponent(key)}`,
        storageKey: key,
        fileName: nama,
        mimeType: mime || null,
        sizeBytes: file.size,
        driver: simpan.driver ?? null,
      },
      'Materi berhasil diunggah.'
    );
  } catch (err) {
    return problem(err, '/api/v1/learning/materials/upload');
  }
}
