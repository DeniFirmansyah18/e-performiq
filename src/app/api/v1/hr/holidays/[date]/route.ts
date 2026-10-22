import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';

export async function DELETE(req: NextRequest, { params }: { params: { date: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'payroll:manage');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      return fail('VALIDATION_ERROR', 'Tanggal harus berformat YYYY-MM-DD.', 400);
    }

    const res = (await db.execute(sql`
      DELETE FROM company_holidays WHERE holiday_date = ${params.date}::date
      RETURNING holiday_date AS "holidayDate"
    `)) as unknown as { rows: Array<{ holidayDate: string }> };

    if (!res.rows?.length) return fail('NOT_FOUND', 'Hari libur tidak ditemukan.', 404);
    return ok({ deleted: res.rows[0].holidayDate }, 'Hari libur dihapus.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menghapus hari libur', status);
  }
}
