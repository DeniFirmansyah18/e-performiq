import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan, can } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listActivity } from '@/lib/services/activityFeedService';

export async function GET(req: NextRequest, { params }: { params: { employeeId: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');

    const isSelf = session.employeeId === params.employeeId;
    const canReadOthers = can(session.role, 'audit:read') || can(session.role, 'attendance:approve');
    if (!isSelf && !canReadOthers) {
      return fail('FORBIDDEN', 'Anda hanya dapat membaca feed aktivitas Anda sendiri.', 403);
    }

    // Kejadian RESTRICTED tidak pernah dikirim lewat feed, bahkan ke auditor;
    // jejaknya hanya ada di audit log.
    const items = (await listActivity(db, params.employeeId, 200))
      .filter((e) => e.visibility !== 'RESTRICTED');
    return ok({ items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat feed', status);
  }
}
