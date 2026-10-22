import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 200) || 200, 500);

    const res = (await db.execute(sql`
      SELECT a.id, a.employee_id AS "employeeId", e.full_name AS "employeeName",
             a.event_type AS "eventType", a.summary, a.visibility,
             a.occurred_at AS "occurredAt"
        FROM activity_events a
        JOIN employees e ON e.id = a.employee_id
       WHERE a.visibility <> 'RESTRICTED'
       ORDER BY a.occurred_at DESC
       LIMIT ${limit}
    `)) as unknown as { rows: unknown[] };

    return ok({ items: res.rows ?? [] });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat feed perusahaan', status);
  }
}
