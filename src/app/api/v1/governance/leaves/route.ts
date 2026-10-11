import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { submitLeaveRequest, listMyLeaveRequests, listPendingLeaveRequests } from '@/lib/services/coreHrService';
import { z } from 'zod';

const LeaveSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'SPECIAL']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalDays: z.number().int().positive().max(12, 'Cuti tahunan maksimal 12 hari kerja'),
  reason: z.string().min(5),
});

// GET /api/v1/governance/leaves?scope=mine|pending
// scope=mine  → permohonan milik karyawan login (default)
// scope=pending → antrean persetujuan (butuh izin approve)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    const scope = req.nextUrl.searchParams.get('scope') ?? 'mine';

    if (scope === 'pending') {
      assertCan(session, 'attendance:approve');
      const items = await listPendingLeaveRequests();
      return ok({ items });
    }

    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);
    const items = await listMyLeaveRequests(session.employeeId);
    return ok({ items });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memuat permohonan cuti', 500);
  }
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await getAuthSession(req);
  } catch {
    return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
  }

  try {
    const body = await req.json();
    const parsed = LeaveSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data permohonan tidak valid', 400);
    }

    if (!session.employeeId) {
      return fail('FORBIDDEN', 'Akun pengguna ini tidak memiliki ID karyawan aktif.', 403);
    }

    const leave = await submitLeaveRequest({
      employeeId: session.employeeId,
      leaveType: parsed.data.leaveType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      totalDays: parsed.data.totalDays,
      reason: parsed.data.reason,
    });

    // Notifikasi HR + atasan: ada permohonan cuti menunggu review (best-effort).
    try {
      const { notifyRoles } = await import('@/lib/services/notificationService');
      await notifyRoles(db, ['HR_MANAGER', 'PEOPLE_MANAGER'], {
        eventType: 'LEAVE_REQUESTED',
        title: 'Pengajuan Cuti Baru',
        body: `Permohonan cuti ${parsed.data.leaveType} (${parsed.data.totalDays} hari, ${parsed.data.startDate} s/d ${parsed.data.endDate}) menunggu persetujuan.`,
      });
    } catch { /* best-effort */ }

    return ok(leave, 'Permohonan cuti berhasil diajukan dan menunggu persetujuan atasan.');
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal mengajukan cuti', 500);
  }
}
