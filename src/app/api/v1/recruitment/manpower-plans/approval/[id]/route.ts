import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { putuskanMpp, MppBukanPengajuError } from '@/lib/services/mppApprovalService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({
  keputusan: z.enum(['APPROVED', 'REJECTED']),
  catatan: z.string().max(2000).optional(),
});

// PATCH /api/v1/recruitment/manpower-plans/approval/[id] — BOD memutuskan MPP
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    // Hanya BOD (dan Super Admin) yang memutuskan; HR mengajukan, bukan mengesahkan.
    assertCan(session, 'recruitment:approve_mpp');

    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Keputusan tidak valid.', 400);
    }

    const mpp = await putuskanMpp(db, {
      id: ctx.params.id,
      keputusan: parsed.data.keputusan,
      userId: session.userId,
      catatan: parsed.data.catatan,
    });

    // Beri tahu HR atas keputusan tersebut (best-effort).
    try {
      const { notifyRoles } = await import('@/lib/services/notificationService');
      await notifyRoles(db, ['HR_MANAGER'], {
        eventType: parsed.data.keputusan === 'APPROVED' ? 'KPI_ASSIGNED' : 'KPI_ASSIGNED',
        title:
          parsed.data.keputusan === 'APPROVED'
            ? 'Pengajuan MPP disetujui BOD'
            : 'Pengajuan MPP ditolak BOD',
        body:
          `${mpp.departmentName ?? ''} — ${mpp.positionTitle ?? ''} (${mpp.fiscalYear})` +
          (parsed.data.catatan ? `: ${parsed.data.catatan}` : ''),
        severity: parsed.data.keputusan === 'APPROVED' ? 'SUCCESS' : 'WARNING',
      });
    } catch {
      /* notifikasi best-effort */
    }

    return ok(
      mpp,
      parsed.data.keputusan === 'APPROVED' ? 'MPP disetujui.' : 'MPP ditolak.'
    );
  } catch (err) {
    if (err instanceof MppBukanPengajuError) {
      return fail('BUSINESS_RULE_VIOLATION', err.message, 422);
    }
    return problem(err, '/api/v1/recruitment/manpower-plans/approval/[id]');
  }
}
