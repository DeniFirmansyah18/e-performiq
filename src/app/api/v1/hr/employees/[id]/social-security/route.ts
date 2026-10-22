import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { upsertSocialSecurity } from '@/lib/services/socialSecurityService';

const BPJS_NUMBER = z
  .string()
  .max(20)
  .refine((v) => v === '' || /^\d{8,20}$/.test(v), {
    message: 'Nomor BPJS harus 8–20 digit angka.',
  });

const BodySchema = z.object({
  bpjsTkNumber: BPJS_NUMBER.nullable().optional(),
  bpjsKesNumber: BPJS_NUMBER.nullable().optional(),
  bpjsKesClass: z.string().max(20).nullable().optional(),
  bpjsTkStatus: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
  bpjsKesStatus: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
  registeredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'social_security:manage');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await upsertSocialSecurity(db, { employeeId: params.id, ...parsed.data });
    return ok(row, 'Data BPJS tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menyimpan data BPJS',
      status,
    );
  }
}
