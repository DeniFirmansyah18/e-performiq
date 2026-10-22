import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getPolicy } from '@/lib/services/policyService';
import { getObject } from '@/lib/storage/fileStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/policies/:id/file
 *
 * Mengalirkan berkas SOP yang tersimpan di object storage. Dokumen lama yang
 * hanya punya URL eksternal tidak punya objek tersimpan → 404 dengan pesan
 * yang menyuruh memakai URL tersebut.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');

    const doc = await getPolicy(db, params.id);
    if (!doc) return fail('NOT_FOUND', 'Dokumen tidak ditemukan.', 404);
    if (!doc.storageKey) {
      return fail('NOT_FOUND', 'Dokumen ini tidak memiliki berkas tersimpan; gunakan URL pada dokumen.', 404);
    }

    const object = await getObject(doc.storageKey);
    if (!object) return fail('NOT_FOUND', 'Berkas tidak ditemukan di penyimpanan.', 404);

    const fileName = doc.fileName ?? `${doc.documentCode}-v${doc.version}.pdf`;

    return new Response(new Uint8Array(object.body), {
      status: 200,
      headers: {
        'Content-Type': object.contentType || 'application/pdf',
        'Content-Length': String(object.body.length),
        // inline: pratinjau di peramban; nama berkas disanitasi di storage.
        'Content-Disposition': `inline; filename="${fileName.replace(/["\\]/g, '')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengunduh berkas SOP', status);
  }
}
