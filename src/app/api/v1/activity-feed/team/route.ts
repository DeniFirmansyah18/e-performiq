import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';

/** Bawahan langsung dan tidak langsung (PRD §6.2). */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'attendance:approve');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const res = (await db.execute(sql`
      WITH RECURSIVE reports AS (
        SELECT id FROM employees WHERE manager_id = ${session.employeeId}::uuid
        UNION
        SELECT e.id FROM employees e JOIN reports r ON e.manager_id = r.id
      )
      SELECT a.id, a.employee_id AS "employeeId", e.full_name AS "employeeName",
             a.event_type AS "eventType", a.summary, a.visibility,
             a.occurred_at AS "occurredAt"
        FROM activity_events a
        JOIN employees e ON e.id = a.employee_id
        JOIN reports r ON r.id = a.employee_id
       WHERE a.visibility <> 'RESTRICTED'
       ORDER BY a.occurred_at DESC
       LIMIT 200
    `)) as unknown as { rows: unknown[] };

    return ok({ items: res.rows ?? [] });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat feed tim', status);
  }
}
