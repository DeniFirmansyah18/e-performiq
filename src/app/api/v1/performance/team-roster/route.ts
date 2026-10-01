import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { resolveVisibleEmployeeIds } from '@/lib/auth/scope';
import { ok, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/team-roster
// Daftar bawahan sesuai scope manajer + ringkasan appraisal terakhirnya.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const scope = await resolveVisibleEmployeeIds(db, session);

    const res = (await db.execute(sql`
      SELECT e.id as "employeeId", e.employee_code as "employeeCode",
             e.full_name as "fullName", e.status,
             d.department_name as "department", jp.position_title as "position",
             pa.composite_gpa as "compositeGpa",
             pa.performance_rating as "performanceRating",
             pa.nine_box_quadrant as "nineBoxQuadrant"
        FROM employees e
        JOIN departments d ON d.id = e.department_id
        JOIN job_positions jp ON jp.id = e.position_id
        LEFT JOIN LATERAL (
          SELECT composite_gpa, performance_rating, nine_box_quadrant
            FROM performance_appraisals pa
           WHERE pa.employee_id = e.id
           ORDER BY pa.created_at DESC LIMIT 1
        ) pa ON TRUE
       WHERE ${
         scope === 'ALL'
           ? sql`TRUE`
           : scope.length > 0
           ? sql`e.id = ANY(${sql.raw(`ARRAY['${scope.join("','")}']::uuid[]`)})`
           : sql`FALSE`
       }
       ORDER BY e.full_name ASC
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    const members = res.rows.map((r) => ({
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      fullName: r.fullName,
      status: r.status,
      department: r.department,
      position: r.position,
      compositeGpa: r.compositeGpa != null ? Number(r.compositeGpa) : null,
      performanceRating: r.performanceRating ?? null,
      nineBoxQuadrant: r.nineBoxQuadrant ?? null,
    }));

    return ok({ members, total: members.length });
  } catch (err) {
    return problem(err, '/api/v1/performance/team-roster');
  }
}
