import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { rateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rateLimit';
import { buildStorageKey, putObject, storageDriver } from '@/lib/storage/fileStorage';
import { validatePdf } from '@/lib/storage/pdfValidation';
import { scanBuffer } from '@/lib/storage/scanFile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Batas ukuran berkas SOP (keputusan produk: 10 MB). */
const MAX_SIZE = 10 * 1024 * 1024;
/** Batas halaman PDF — menjaga waktu render & penyimpanan tetap wajar. */
const MAX_PAGES = 300;
/** Unggahan mahal (I/O + pemindaian): 10 per menit per pengguna. */
const UPLOAD_LIMIT = 10;
const UPLOAD_WINDOW_MS = 60_000;

/**
 * POST /api/v1/policies/upload  (multipart/form-data, field `file`)
 *
 * Menyimpan PDF ke object storage dan mengembalikan `storageKey` yang dipakai
 * saat menerbitkan versi dokumen. Berkas tidak pernah masuk database.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'policy:manage');

    const limited = rateLimit(rateLimitKey(req, session.userId), UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
    if (!limited.allowed) {
      const res = fail(
        'RATE_LIMITED',
        `Terlalu banyak unggahan. Coba lagi dalam ${limited.retryAfterSeconds} detik.`,
        429,
      );
      for (const [k, v] of Object.entries(rateLimitHeaders(limited, UPLOAD_LIMIT))) {
        res.headers.set(k, v);
      }
      return res;
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return fail('BAD_REQUEST', 'Format unggahan tidak valid (butuh multipart/form-data).', 400);
    }

    const file = form.get('file');
    if (!(file instanceof File)) return fail('BAD_REQUEST', 'Berkas wajib diunggah.', 400);
    if (file.size === 0) return fail('BAD_REQUEST', 'Berkas kosong.', 400);
    if (file.size > MAX_SIZE) {
      return fail('PAYLOAD_TOO_LARGE', 'Ukuran berkas melebihi 10 MB.', 413);
    }
    if (!/\.pdf$/i.test(file.name)) {
      return fail('UNSUPPORTED_MEDIA_TYPE', 'Berkas SOP harus PDF.', 415);
    }

    const body = Buffer.from(await file.arrayBuffer());

    const pdf = await validatePdf(body, { maxPages: MAX_PAGES });
    if (!pdf.ok) return fail('VALIDATION_ERROR', pdf.reason ?? 'Berkas PDF tidak valid.', 400);

    const scan = await scanBuffer(body);
    if (scan.status === 'INFECTED') {
      return fail('VALIDATION_ERROR', `Berkas ditolak pemindai: ${scan.signature ?? 'malware'}.`, 422);
    }
    // Bila pemindaian diwajibkan, SKIPPED tidak boleh lolos.
    if (scan.status === 'SKIPPED' && process.env.SOP_UPLOAD_REQUIRE_SCAN === '1') {
      return fail(
        'SCANNER_UNAVAILABLE',
        `Pemindaian berkas tidak tersedia (${scan.reason ?? 'clamd tidak aktif'}). Unggahan ditolak karena kebijakan mewajibkan pemindaian.`,
        503,
      );
    }

    const key = buildStorageKey('policies', file.name);
    const stored = await putObject(key, body, 'application/pdf');

    return ok(
      {
        storageKey: stored.key,
        fileName: file.name,
        size: stored.size,
        checksumSha256: stored.checksumSha256,
        pageCount: pdf.pageCount,
        scanStatus: scan.status,
        scanEngine: scan.engine,
        scanReason: scan.reason ?? null,
        driver: storageDriver(),
      },
      'Berkas SOP tersimpan.',
    );
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : status === 422 ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengunggah berkas SOP',
      status,
    );
  }
}
