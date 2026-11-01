import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { resolveVisibleEmployeeIds } from '@/lib/auth/scope';

export interface RosterRow {
  employeeId: string;
  employeeCode: string | null;
  fullName: string;
  status: string | null;
  department: string | null;
  position: string | null;
  compositeGpa: number | null;
  performanceRating: string | null;
  nineBoxQuadrant: string | null;
  /** Jumlah KPI periode aktif milik karyawan. */
  kpiCount: number;
  /** KPI yang masih menunggu persetujuan atasan. */
  pendingKpiCount: number;
  /** Ringkasan capaian KPI periode terbaru (%) — `null` bila belum ada capaian. */
  kpiAchievement: number | null;
  activeIndicatorCount: number;
  managerName: string | null;
}

/**
 * Roster tim dari DB (bukan data demo) beserta ringkasan KPI/indikator yang
 * dipakai dashboard People Manager. Cakupan mengikuti `resolveVisibleEmployeeIds`.
 */
export async function selectRoster(
  db: Db,
  session: SessionPayload,
  periodId?: string
): Promise<RosterRow[]> {
  const scope = await resolveVisibleEmployeeIds(db, session);
  const scopeClause =
    scope === 'ALL'
      ? sql`TRUE`
      : scope.length > 0
      ? sql`e.id = ANY(${sql.raw(`ARRAY['${scope.join("','")}']::uuid[]`)})`
      : sql`FALSE`;

  const periodClause = periodId ? sql`AND k2.period_id = ${periodId}::uuid` : sql``;

  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.employee_code AS "employeeCode",
           e.full_name AS "fullName", e.status,
           d.department_name AS "department", jp.position_title AS "position",
           mgr.full_name AS "managerName",
           pa.composite_gpa AS "compositeGpa",
           pa.performance_rating AS "performanceRating",
           pa.nine_box_quadrant AS "nineBoxQuadrant",
           COALESCE(kpi.kpi_count, 0)::int AS "kpiCount",
           COALESCE(kpi.pending_count, 0)::int AS "pendingKpiCount",
           kpi.achievement AS "kpiAchievement",
           COALESCE(ind.active_indicators, 0)::int AS "activeIndicatorCount"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN job_positions jp ON jp.id = e.position_id
      LEFT JOIN employees mgr ON mgr.id = e.manager_id
      LEFT JOIN LATERAL (
        SELECT composite_gpa, performance_rating, nine_box_quadrant
          FROM performance_appraisals p
         WHERE p.employee_id = e.id
         ORDER BY p.created_at DESC LIMIT 1
      ) pa ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS kpi_count,
               COUNT(*) FILTER (WHERE k2.status <> 'APPROVED') AS pending_count,
               SUM(k2.achievement_percentage) AS achievement
          FROM individual_kpis k2
         WHERE k2.employee_id = e.id ${periodClause}
      ) kpi ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS active_indicators
          FROM kpi_indicators i
          JOIN individual_kpis k2 ON k2.id = i.kpi_id
         WHERE k2.employee_id = e.id
           AND i.is_active = TRUE
           ${periodClause}
      ) ind ON TRUE
     WHERE ${scopeClause}
     ORDER BY e.full_name ASC
  `)) as unknown as { rows: Array<Record<string, unknown>> };

  return res.rows.map((r) => ({
    employeeId: String(r.employeeId),
    employeeCode: (r.employeeCode as string | null) ?? null,
    fullName: String(r.fullName),
    status: (r.status as string | null) ?? null,
    department: (r.department as string | null) ?? null,
    position: (r.position as string | null) ?? null,
    compositeGpa: r.compositeGpa != null ? Number(r.compositeGpa) : null,
    performanceRating: (r.performanceRating as string | null) ?? null,
    nineBoxQuadrant: (r.nineBoxQuadrant as string | null) ?? null,
    kpiCount: Number(r.kpiCount ?? 0),
    pendingKpiCount: Number(r.pendingKpiCount ?? 0),
    kpiAchievement: r.kpiAchievement != null ? Number(r.kpiAchievement) : null,
    activeIndicatorCount: Number(r.activeIndicatorCount ?? 0),
    managerName: (r.managerName as string | null) ?? null,
  }));
}
