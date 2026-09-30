import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/badges - daftar badge + status award untuk karyawan sesi.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const employeeId = session.employeeId;

    const badges = (await db.execute(sql`
      SELECT b.code, b.name, b.description, b.badge_type AS "badgeType",
             (ba.id IS NOT NULL) AS "earned", ba.awarded_at AS "awardedAt"
        FROM badges b
        LEFT JOIN badge_awards ba ON ba.badge_id = b.id AND ba.employee_id = ${employeeId ?? null}::uuid
       WHERE b.is_active = TRUE ORDER BY b.code
    `)) as unknown as { rows: any[] };

    return ok({
      badges: (badges.rows ?? []).map((b) => ({ ...b, earned: Boolean(b.earned) })),
    });
  } catch (err) {
    return problem(err, '/api/v1/learning/badges');
  }
}
