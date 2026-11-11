import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { getTargetAchievement } from '@/lib/services/targetAchievementService';
import { analisisCapaianTarget } from '@/lib/services/targetAchievementAi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/performance/target-achievement/analisis
 * Rekomendasi tindakan dari AI berdasarkan capaian target per departemen.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'kpi:read');

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('period_id') ?? undefined;

    const data = await getTargetAchievement(db, session, periodId ? { periodId } : undefined);

    const hasil = await analisisCapaianTarget(
      db,
      {
        scopeLevel: data.scopeLevel,
        overallPercentage: data.overallPercentage ?? 0,
        targetCount: data.targetCount ?? 0,
        achievedCount: data.achievedCount ?? 0,
        departments: (data.departments ?? []).map((d: any) => ({
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          averagePercentage: Number(d.averagePercentage ?? 0),
          employeeCount: Number(d.employeeCount ?? 0),
          kpiCount: Number(d.kpiCount ?? 0),
        })),
      },
      session.role
    );

    return ok(hasil);
  } catch (err) {
    return problem(err, '/api/v1/performance/target-achievement/analisis');
  }
}
