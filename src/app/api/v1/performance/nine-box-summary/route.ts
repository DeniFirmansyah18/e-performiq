import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/nine-box-summary
// Jumlah karyawan per kuadran 9-Box (angka ringkas dashboard).
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);

    const res = (await db.execute(sql`
      SELECT nine_box_quadrant as "quadrant", COUNT(*)::int as "count"
        FROM performance_appraisals
       GROUP BY nine_box_quadrant
    `)) as unknown as { rows: Array<{ quadrant: string; count: number }> };

    const byQuadrant: Record<string, number> = {};
    let total = 0;
    for (const row of res.rows ?? []) {
      byQuadrant[row.quadrant] = Number(row.count);
      total += Number(row.count);
    }

    return ok({ total, byQuadrant });
  } catch (err) {
    return problem(err, '/api/v1/performance/nine-box-summary');
  }
}
