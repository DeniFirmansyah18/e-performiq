import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { requestCorrection } from '@/lib/services/attendanceCorrectionService';

const BodySchema = z
  .object({
    attendanceLogId: z.string().uuid(),
    requestedCheckInAt: z.string().datetime({ offset: true }).optional(),
    requestedCheckOutAt: z.string().datetime({ offset: true }).optional(),
    reason: z.string().min(5).max(500),
  })
  .refine((v) => v.requestedCheckInAt || v.requestedCheckOutAt, {
    message: 'Isi minimal satu jam pengganti (masuk atau keluar).',
  });

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await requestCorrection(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, 'Koreksi absensi terkirim dan menunggu keputusan HRD.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengajukan koreksi',
      status,
    );
  }
}
