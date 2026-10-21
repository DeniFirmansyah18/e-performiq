import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { readiness } from '@/lib/services/careerLadderService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const employees = (await db.execute(sql`
      SELECT id, full_name AS "fullName" FROM employees
       WHERE status <> 'RESIGNED' ORDER BY full_name
    `)) as unknown as { rows: Array<{ id: string; fullName: string }> };

    const items: Array<{
      employeeId: string; fullName: string; percent: number; targetPositionId: string | null;
    }> = [];

    for (const e of employees.rows ?? []) {
      const r = await readiness(db, e.id);
      if (r.total > 0 && r.percent >= 80) {
        items.push({
          employeeId: e.id, fullName: e.fullName,
          percent: r.percent, targetPositionId: r.targetPositionId,
        });
      }
    }
    return ok({ items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat kandidat suksesi', status);
  }
}
