import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail } from '@/lib/api/response';
import { submitLeaveRequest } from '@/lib/services/coreHrService';
import { z } from 'zod';

const LeaveSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'SPECIAL']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalDays: z.number().int().positive().max(12, 'Cuti tahunan maksimal 12 hari kerja'),
  reason: z.string().min(5),
});

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
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

    return ok(leave, 'Permohonan cuti berhasil diajukan dan menunggu persetujuan atasan.');
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal mengajukan cuti', 500);
  }
}
