import { NextRequest } from 'next/server';
import { ok, fail, problem } from '@/lib/api/response';
import { rateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rateLimit';
import { buildStorageKey, putObject } from '@/lib/storage/fileStorage';
import {
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  validateVideoMetadata,
  extractMp4Duration,
} from '@/lib/services/videoValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_LIMIT = 20;
const UPLOAD_WINDOW_MS = 10 * 60_000;

/**
 * POST /api/v1/careers/upload-video  (PUBLIK, multipart/form-data)
 *
 * Menerima berkas video perkenalan diri kandidat (unjuk spesialisasi):
 * - Batas ukuran: <= 10 MB
 * - Batas durasi: <= 2 menit (120 detik)
 * - Format: MP4, WebM, MOV
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(rateLimitKey(req), UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
    if (!limited.allowed) {
      const res = fail(
        'RATE_LIMITED',
        `Terlalu banyak permintaan unggah. Coba lagi dalam ${limited.retryAfterSeconds} detik.`,
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
    if (!(file instanceof File)) {
      return fail('BAD_REQUEST', 'Berkas video wajib diunggah.', 400);
    }

    const reportedDurationStr = form.get('duration');
    const reportedDuration = reportedDurationStr ? Number(reportedDurationStr) : null;

    const validation = validateVideoMetadata({
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
      reportedDuration,
    });

    if (!validation.valid) {
      if (file.size > MAX_VIDEO_SIZE_BYTES) {
        return fail('PAYLOAD_TOO_LARGE', validation.error || 'Ukuran berkas video melebihi 10 MB.', 413);
      }
      if (validation.error?.includes('Format video tidak didukung')) {
        return fail('UNSUPPORTED_MEDIA_TYPE', validation.error, 415);
      }
      return fail('VALIDATION_ERROR', validation.error || 'Validasi video gagal.', 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sabuk pengaman server-side: cek metadata container MP4/MOV bila memungkinkan
    const parsedDuration = extractMp4Duration(buffer);
    const finalDuration = parsedDuration ?? (reportedDuration && Number.isFinite(reportedDuration) ? reportedDuration : null);

    if (finalDuration != null && finalDuration > MAX_VIDEO_DURATION_SECONDS + 1.5) {
      const m = Math.floor(finalDuration / 60);
      const s = Math.floor(finalDuration % 60);
      return fail(
        'VALIDATION_ERROR',
        `Durasi video (${m}:${String(s).padStart(2, '0')}) melebihi batas maksimal 2 menit.`,
        400,
      );
    }

    const contentType = file.type || 'video/mp4';
    const key = buildStorageKey('candidates/videos', file.name, '.mp4');
    const stored = await putObject(key, buffer, contentType);

    return ok(
      {
        key: stored.key,
        fileUrl: `/api/v1/careers/media/${encodeURIComponent(stored.key)}`,
        fileName: file.name,
        mimeType: contentType,
        size: stored.size,
        duration: finalDuration,
      },
      'Video perkenalan berhasil diunggah.',
    );
  } catch (err) {
    return problem(err, '/api/v1/careers/upload-video');
  }
}

