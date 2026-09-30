import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ok, problem } from '@/lib/api/response';
import { ForbiddenError } from '@/lib/auth/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/my-scorecard[?employee_id=]
// Mengembalikan appraisal terakhir milik karyawan (default: diri sendiri).
// Akses lintas-karyawan ditegakkan oleh scope (403 bila di luar wewenang).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const target = searchParams.get('employee_id') ?? session.employeeId ?? undefined;
    if (!target) {
      throw new ForbiddenError('Tidak ada karyawan yang terkait dengan sesi ini.');
    }

    const scope = await resolveVisibleEmployeeIds(db, session);
    assertEmployeeVisible(scope, target);

    const res = (await db.execute(sql`
      SELECT pa.employee_id as "employeeId", pa.period_id as "periodId",
             pa.kpi_composite_score as "kpiCompositeScore",
             pa.sop_compliance_score as "sopComplianceScore",
             pa.competency_score as "competencyScore",
             pa.core_values_score as "coreValuesScore",
             pa.total_percentage_score as "totalPercentageScore",
             pa.composite_gpa as "compositeGpa",
             pa.performance_rating as "performanceRating",
             pa.nine_box_quadrant as "nineBoxQuadrant",
             e.full_name as "fullName", e.employee_code as "employeeCode"
        FROM performance_appraisals pa
        JOIN employees e ON e.id = pa.employee_id
       WHERE pa.employee_id = ${target}::uuid
       ORDER BY pa.created_at DESC
       LIMIT 1
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    const row = res.rows[0];
    if (!row) {
      return ok(null, 'Belum ada appraisal untuk karyawan ini.');
    }

    return ok({
      employeeId: row.employeeId,
      fullName: row.fullName,
      employeeCode: row.employeeCode,
      periodId: row.periodId,
      kpiCompositeScore: Number(row.kpiCompositeScore),
      sopComplianceScore: Number(row.sopComplianceScore),
      competencyScore: Number(row.competencyScore),
      coreValuesScore: Number(row.coreValuesScore),
      totalPercentageScore: Number(row.totalPercentageScore),
      compositeGpa: Number(row.compositeGpa),
      performanceRating: row.performanceRating,
      nineBoxQuadrant: row.nineBoxQuadrant,
    });
  } catch (err) {
    return problem(err, '/api/v1/performance/my-scorecard');
  }
}
