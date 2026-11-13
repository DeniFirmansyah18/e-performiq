import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import {
  issueDisciplinary, listAllDisciplinary, type AppealStatus,
} from '@/lib/services/disciplinaryService';

const VALID_APPEAL: AppealStatus[] = ['NONE', 'UNDER_APPEAL', 'APPEAL_ACCEPTED', 'APPEAL_REJECTED'];

const CreateSchema = z.object({
  employeeId: z.string().uuid(),
  actionType: z.enum(['TEGURAN', 'SP1', 'SP2', 'SP3']),
  reason: z.string().min(5).max(2000),
  evidenceUrl: z.string().url().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Poin pelanggaran: bila kosong, diisi bobot baku menurut jenis sanksi.
  violationPoints: z.number().int().min(0).max(100).optional(),
  violationCategory: z
    .enum(['ABSENSI', 'KODE_ETIK', 'KINERJA', 'KEPATUHAN', 'LAINNYA'])
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'disciplinary:manage');

    const rawAppeal = req.nextUrl.searchParams.get('appealStatus');
    if (rawAppeal && !VALID_APPEAL.includes(rawAppeal as AppealStatus)) {
      return fail('VALIDATION_ERROR', `appealStatus '${rawAppeal}' tidak dikenal.`, 400);
    }

    const employeeId = req.nextUrl.searchParams.get('employeeId') ?? undefined;
    const items = await listAllDisciplinary(db, {
      employeeId,
      appealStatus: (rawAppeal as AppealStatus) ?? undefined,
    });
    return ok({ items, total: items.length });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat sanksi', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'disciplinary:manage');

    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await issueDisciplinary(db, { ...parsed.data, issuedBy: session.userId });
    return ok(row, 'Sanksi diterbitkan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menerbitkan sanksi',
      status,
    );
  }
}
