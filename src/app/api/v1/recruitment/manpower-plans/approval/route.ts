import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import {
  ajukanMpp,
  daftarSemuaMpp,
  daftarMppMenunggu,
  daftarPeopleManager,
  MppButuhAtasanError,
} from '@/lib/services/mppApprovalService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AjukanSchema = z.object({
  departmentId: z.string().min(1),
  positionId: z.string().min(1),
  fiscalYear: z.number().int().min(2000).max(2100),
  approvedQuota: z.number().int().min(0),
  allocatedBudget: z.number().min(0),
  managerId: z.string().min(1),
});

// GET /api/v1/recruitment/manpower-plans/approval?mode=menunggu|semua|manager
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');

    const mode = req.nextUrl.searchParams.get('mode') ?? 'semua';
    if (mode === 'menunggu') return ok(await daftarMppMenunggu(db));
    if (mode === 'manager') return ok(await daftarPeopleManager(db));
    return ok(await daftarSemuaMpp(db));
  } catch (err) {
    return problem(err, '/api/v1/recruitment/manpower-plans/approval');
  }
}

// POST /api/v1/recruitment/manpower-plans/approval — HR mengajukan MPP baru (PENDING)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');

    const parsed = AjukanSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Data pengajuan MPP tidak valid.', 400);
    }

    const mpp = await ajukanMpp(db, { ...parsed.data, userId: session.userId });

    // Beri tahu BOD bahwa ada pengajuan menunggu keputusan (best-effort).
    try {
      const { notifyRoles } = await import('@/lib/services/notificationService');
      await notifyRoles(db, ['BOD'], {
        eventType: 'KPI_ASSIGNED',
        title: 'Pengajuan MPP baru menunggu keputusan',
        body: `HRD mengajukan MPP ${mpp.departmentName ?? ''} — ${mpp.positionTitle ?? ''} tahun ${mpp.fiscalYear} (kuota ${mpp.approvedQuota}).`,
        severity: 'INFO',
      });
    } catch {
      /* notifikasi best-effort */
    }

    return ok(mpp, 'Pengajuan MPP dikirim ke BOD untuk diputuskan.');
  } catch (err) {
    if (err instanceof MppButuhAtasanError) {
      return fail('VALIDATION_ERROR', err.message, 400);
    }
    return problem(err, '/api/v1/recruitment/manpower-plans/approval');
  }
}
