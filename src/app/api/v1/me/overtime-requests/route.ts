import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listOvertime, requestOvertime } from '@/lib/services/overtimeService';

const BodySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedHours: z.number().positive().max(10),
  reason: z.string().min(5).max(500),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'overtime:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const items = await listOvertime(db, session.employeeId);
    return ok({ items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat pengajuan lembur', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'overtime:request');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await requestOvertime(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, 'Pengajuan lembur terkirim dan menunggu persetujuan atasan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengajukan lembur',
      status,
    );
  }
}
