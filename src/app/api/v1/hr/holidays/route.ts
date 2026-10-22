import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';

const BodySchema = z.object({
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(3).max(150),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'payroll:manage');

    const raw = req.nextUrl.searchParams.get('year');
    const year = raw && /^\d{4}$/.test(raw) ? Number(raw) : null;

    const res = (await db.execute(sql`
      SELECT id, holiday_date AS "holidayDate", name
        FROM company_holidays
       WHERE (${year}::int IS NULL OR EXTRACT(YEAR FROM holiday_date) = ${year}::int)
       ORDER BY holiday_date
    `)) as unknown as { rows: Array<{ id: string; holidayDate: string; name: string }> };

    return ok({ items: res.rows ?? [] });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat kalender libur', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'payroll:manage');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const res = (await db.execute(sql`
      INSERT INTO company_holidays (holiday_date, name)
      VALUES (${parsed.data.holidayDate}::date, ${parsed.data.name})
      ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, holiday_date AS "holidayDate", name
    `)) as unknown as { rows: Array<{ id: string; holidayDate: string; name: string }> };

    return ok(res.rows[0], 'Kalender hari libur tersimpan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menyimpan hari libur', status);
  }
}
