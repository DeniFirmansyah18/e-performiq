import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listEntries, saveEntry } from '@/lib/services/dailyKpiService';

const EntrySchema = z.object({
  indicatorId: z.string().uuid(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualValue: z.number().min(0),
  note: z.string().max(500).optional(),
  evidenceUrl: z.string().url().optional(),
  submit: z.boolean().default(false),
});

const isoDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:read');

    const today = isoDay();
    const from = req.nextUrl.searchParams.get('from') ?? today;
    const to = req.nextUrl.searchParams.get('to') ?? today;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(from) || !dateRe.test(to)) {
      return fail('VALIDATION_ERROR', 'Format tanggal harus YYYY-MM-DD.', 400);
    }

    // `employeeId` hanya boleh dipakai pengawas; karyawan selalu membaca miliknya.
    const requested = req.nextUrl.searchParams.get('employeeId');
    let target = session.employeeId;
    if (requested && requested !== session.employeeId) {
      assertCan(session, 'kpi:approve');
      target = requested;
    }
    if (!target) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const items = await listEntries(db, target, from, to);
    return ok({ items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat entri harian', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'kpi:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = EntrySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await saveEntry(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, parsed.data.submit ? 'Realisasi terkirim.' : 'Draf tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menyimpan entri',
      status,
    );
  }
}
