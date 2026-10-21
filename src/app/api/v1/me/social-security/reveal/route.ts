import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { revealSocialSecurity } from '@/lib/services/socialSecurityService';

const BodySchema = z.object({ reason: z.string().min(5).max(200) });

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'social_security:reveal');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Alasan wajib diisi (minimal 5 karakter).', 400);
    }

    const data = await revealSocialSecurity(db, {
      employeeId: session.employeeId, userId: session.userId, reason: parsed.data.reason,
    });
    return ok(data, 'Akses tercatat pada audit log.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal membuka data BPJS',
      status,
    );
  }
}
