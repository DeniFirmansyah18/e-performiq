import { NextRequest } from 'next/server';
import { ok, fail, problem } from '@/lib/api/response';
import { extractResumeText, parseResume, extractSkills } from '@/lib/services/resumeParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Batas ukuran aman (5 MB) — menghindari memori berlebih di serverless.
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXT = ['.pdf', '.docx', '.doc', '.txt', '.md', '.rtf'];

/**
 * POST /api/v1/careers/upload  (PUBLIK, multipart/form-data)
 *
 * Field multipart: `file` (berkas resume), `jobPostingId` (opsional, untuk
 * menghitung requirement skill pada tahap apply).
 *
 * Serverless-safe: berkas TIDAK disimpan di disk (Vercel FS read-only). Endpoint
 * hanya mengekstrak teks, mem-parsing heuristik, dan mengembalikannya ke klien.
 * Klien lalu mengirim `resumeText` pada request `/apply`. Bila ekstraksi gagal
 * (mis. PDF terkompresi), endpoint tetap 200 dengan parsed kosong + flag.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return fail('BAD_REQUEST', 'Format unggahan tidak valid (butuh multipart/form-data).', 400);

    const file = form.get('file');
    if (!(file instanceof File)) return fail('BAD_REQUEST', 'Berkas resume wajib diunggah.', 400);
    if (file.size === 0) return fail('BAD_REQUEST', 'Berkas kosong.', 400);
    if (file.size > MAX_SIZE) return fail('PAYLOAD_TOO_LARGE', 'Ukuran berkas melebihi 5 MB.', 413);

    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
      return fail('UNSUPPORTED_MEDIA_TYPE', 'Format berkas harus PDF, DOCX, atau TXT.', 415);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractResumeText(file.name, buffer);
    // Heuristik selalu jalan; AI dipakai untuk memperkaya (mis. gender/NIK/alamat
    // yang tak berlabel rapi) bila terkonfigurasi. Best-effort — tak pernah crash.
    const parsed = await parseResume(rawText, { useAi: true });

    const extracted = rawText.trim().length >= 20;
    return ok({
      fileName: file.name,
      size: file.size,
      extracted,
      rawText: extracted ? rawText.slice(0, 20000) : '',
      detectedSkills: extractSkills(rawText),
      parsed,
      note: extracted
        ? 'Teks resume berhasil diekstrak.'
        : 'Teks tidak dapat diekstrak dari berkas (kemungkinan PDF hasil pindai/gambar). ' +
          'Isi kolom secara manual; sistem akan mencoba analisis AI saat lamaran dikirim.',
    });
  } catch (err) {
    return problem(err, '/api/v1/careers/upload');
  }
}
