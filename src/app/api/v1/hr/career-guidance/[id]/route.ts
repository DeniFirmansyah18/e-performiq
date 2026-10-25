import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { db } from '@/lib/db/client';
import { getCareerGuidanceForEmployee } from '@/lib/services/hrActionRecommendationService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'career:read');

    if (!UUID_RE.test(params.id)) {
      return fail('VALIDATION_ERROR', 'ID karyawan harus berupa UUID.', 400);
    }

    // Karyawan hanya boleh melihat panduan karirnya sendiri.
    const scope = await resolveVisibleEmployeeIds(db, session);
    assertEmployeeVisible(scope, params.id);

    const data = await getCareerGuidanceForEmployee(db, params.id);
    return ok(data);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    if (status === 403) return fail('FORBIDDEN', err?.message ?? 'Akses ditolak.', 403);
    if (err?.message === 'Karyawan tidak ditemukan.') {
      return fail('NOT_FOUND', err.message, 404);
    }
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat panduan karir', status);
  }
}
