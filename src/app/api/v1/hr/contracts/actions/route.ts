import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { extendContract, convertToPermanent } from '@/lib/services/contractActionService';

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD.');

const ExtendSchema = z.object({
  action: z.literal('EXTEND'),
  newEndDate: DateString,
  effectiveDate: DateString,
  reason: z.string().min(5, 'Alasan minimal 5 karakter.'),
});

const ConvertSchema = z.object({
  action: z.literal('CONVERT_TO_PERMANENT'),
  effectiveDate: DateString,
  reason: z.string().min(5, 'Alasan minimal 5 karakter.'),
});

const BodySchema = z.discriminatedUnion('action', [ExtendSchema, ConvertSchema]);

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'employment:manage');

    const employeeId = req.nextUrl.searchParams.get('employeeId') ?? '';
    if (!UUID_RE.test(employeeId)) {
      return fail('VALIDATION_ERROR', 'employeeId tidak valid.', 400);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const base = {
      employeeId,
      effectiveDate: parsed.data.effectiveDate,
      reason: parsed.data.reason,
      decidedBy: session.userId,
    };

    if (parsed.data.action === 'EXTEND') {
      const result = await extendContract(db, { ...base, newEndDate: parsed.data.newEndDate });
      return ok(result, 'Kontrak PKWT berhasil diperpanjang.');
    }

    const result = await convertToPermanent(db, base);
    return ok(result, 'Pegawai berhasil diangkat menjadi pegawai tetap.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const code =
      status === 422
        ? 'BUSINESS_RULE_VIOLATION'
        : status === 403
          ? 'FORBIDDEN'
          : status === 404
            ? 'NOT_FOUND'
            : 'INTERNAL_ERROR';
    return fail(code, err?.message ?? 'Gagal memproses tindakan kontrak', status);
  }
}
