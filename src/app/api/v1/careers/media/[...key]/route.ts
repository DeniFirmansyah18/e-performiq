import { NextRequest } from 'next/server';
import { fail, problem } from '@/lib/api/response';
import { assertSafeKey, getObject } from '@/lib/storage/fileStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/careers/media/[...key]
 *
 * Mengalirkan berkas media kandidat (video perkenalan / dokumen) dengan
 * dukungan HTTP 206 (Range request) agar pemutar video peramban dapat
 * memutar dan melakukan scrubbing dengan mulus.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } },
) {
  try {
    const rawKey = Array.isArray(params.key) ? params.key.join('/') : String(params.key || '');
    const decodedKey = decodeURIComponent(rawKey);

    assertSafeKey(decodedKey);

    const object = await getObject(decodedKey);
    if (!object) {
      return fail('NOT_FOUND', 'Berkas media tidak ditemukan.', 404);
    }

    const totalLength = object.body.length;
    const contentType = object.contentType || 'video/mp4';
    const rangeHeader = req.headers.get('range');

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

      if (!isNaN(start) && start < totalLength && end >= start && end < totalLength) {
        const chunk = object.body.subarray(start, end + 1);
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${totalLength}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunk.length),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }

    return new Response(new Uint8Array(object.body), {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(totalLength),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    if (err?.message?.includes('Key penyimpanan tidak valid')) {
      return fail('BAD_REQUEST', 'Key media tidak valid.', 400);
    }
    return problem(err, '/api/v1/careers/media');
  }
}

