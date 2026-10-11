import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/360-reviews/peers
// Kandidat rekan kerja (evaluatee) untuk picker review 360°: karyawan aktif
// selain diri sendiri. Nama+jabatan saja (tanpa data sensitif).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const res = (await db.execute(sql`
      SELECT e.id,
             e.full_name AS "fullName",
             COALESCE(p.position_title, '') AS "positionTitle"
        FROM employees e
        LEFT JOIN job_positions p ON p.id = e.position_id
       WHERE e.status IN ('PERMANENT','PROBATION','CONTRACT')
         AND e.id <> COALESCE(${session.employeeId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
       ORDER BY e.full_name ASC
       LIMIT 200
    `)) as unknown as { rows: Array<{ id: string; fullName: string; positionTitle: string }> };
    return ok({ peers: res.rows ?? [] });
  } catch (err) {
    return problem(err, '/api/v1/performance/360-reviews/peers');
  }
}
