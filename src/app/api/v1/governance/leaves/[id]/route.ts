import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem, parseBody } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { decideLeaveRequest } from '@/lib/services/coreHrService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
});

interface Params {
  params: { id: string };
}

// PATCH /api/v1/governance/leaves/:id — setujui/tolak permohonan cuti (HR/atasan).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:approve');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const body = await parseBody(req, DecisionSchema);
    const result = await decideLeaveRequest({
      leaveId: params.id,
      approverId: session.employeeId,
      decision: body.decision,
    });

    // Notifikasi karyawan pemohon atas keputusan cuti (best-effort).
    try {
      const { notifyEmployeeLifecycle } = await import('@/lib/services/notificationService');
      await notifyEmployeeLifecycle(db, {
        employeeId: result.employeeId,
        eventType: 'LEAVE_DECIDED',
        title: body.decision === 'APPROVED' ? 'Cuti Disetujui' : 'Cuti Ditolak',
        body: `Permohonan cuti ${result.leaveType} (${result.startDate} s/d ${result.endDate}) telah ${body.decision === 'APPROVED' ? 'disetujui' : 'ditolak'}.`,
      });
    } catch { /* best-effort */ }

    return ok(result, body.decision === 'APPROVED' ? 'Permohonan cuti disetujui.' : 'Permohonan cuti ditolak.');
  } catch (err) {
    return problem(err, `/api/v1/governance/leaves/${params.id}`);
  }
}
