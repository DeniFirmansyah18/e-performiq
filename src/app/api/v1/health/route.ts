import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { isS3Configured, storageDriver } from '@/lib/storage/fileStorage';
import { clamavConfigured } from '@/lib/storage/scanFile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Status = 'UP' | 'DEGRADED' | 'DOWN';

/**
 * GET /api/v1/health — status dependensi untuk HR/operator.
 *
 * Dilindungi (bukan endpoint publik) agar konfigurasi tidak terbocorkan:
 * tidak ada kredensial, host, atau nama bucket di respons.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'system:health');

    // Database: satu query ringan.
    let database: Status = 'DOWN';
    let latencyMs: number | null = null;
    try {
      const started = Date.now();
      await db.execute(sql`SELECT 1 AS ok`);
      latencyMs = Date.now() - started;
      database = 'UP';
    } catch {
      database = 'DOWN';
    }

    // Storage: terkonfigurasi atau tidak (tanpa menyentuh jaringan).
    const driver = storageDriver();
    const storage: Status = driver === 's3'
      ? (isS3Configured() ? 'UP' : 'DOWN')
      : 'DEGRADED';

    // Pemindai: hanya melaporkan kesiapan konfigurasi.
    const scanner: Status = clamavConfigured() ? 'UP' : 'DEGRADED';

    const overall: Status = database === 'DOWN'
      ? 'DOWN'
      : (storage === 'DEGRADED' || scanner === 'DEGRADED' ? 'DEGRADED' : 'UP');

    return ok({
      status: overall,
      database: { status: database, latencyMs },
      storage: {
        status: storage,
        driver,
        // Disengaja: tanpa nama bucket/endpoint/kredensial.
        note: driver === 'local' ? 'Penyimpanan lokal (bukan object storage).' : 'Object storage S3-compatible.',
      },
      scanner: {
        status: scanner,
        mode: process.env.CLAMAV_MODE === 'cli' ? 'cli' : 'daemon',
        required: process.env.SOP_UPLOAD_REQUIRE_SCAN === '1',
      },
      time: new Date().toISOString(),
    });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memeriksa kesehatan sistem', status);
  }
}
