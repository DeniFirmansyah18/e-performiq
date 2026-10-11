import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { selectKpisByEmployee } from '@/lib/repositories/kpiRepository';
import { selectAppraisalByEmployee } from '@/lib/repositories/appraisalRepository';
import type { KpiPortfolioRow } from './kpiPortfolioPdfService';

export interface KpiPortfolioData {
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  positionTitle: string | null;
  periodId: string;
  periodCode: string;
  kpiScore: number | null;
  totalScore: number | null;
  gpa: number | null;
  rating: string | null;
  rows: KpiPortfolioRow[];
}

/** Periode ACTIVE; bila tak ada, periode terbaru; bila tak ada, apa pun. */
async function resolvePeriodId(db: Db, requested?: string): Promise<string | null> {
  if (requested) return requested;
  const res = (await db.execute(sql`
    SELECT id FROM appraisal_periods
     WHERE status = 'ACTIVE'::period_status_enum
     ORDER BY start_date DESC LIMIT 1
  `)) as unknown as { rows: any[] };
  if (res.rows[0]) return res.rows[0].id;
  const latest = (await db.execute(sql`
    SELECT id FROM appraisal_periods ORDER BY end_date DESC NULLS LAST LIMIT 1
  `)) as unknown as { rows: any[] };
  return latest.rows[0]?.id ?? null;
}

/**
 * Kumpulkan data portofolio KPI satu karyawan untuk satu periode, langsung dari
 * basis data (individual_kpis + performance_appraisals + employees join).
 */
export async function getKpiPortfolioPdfData(
  db: Db,
  employeeId: string,
  periodId?: string
): Promise<KpiPortfolioData | null> {
  const empRes = (await db.execute(sql`
    SELECT e.full_name AS "fullName", e.employee_code AS "employeeCode",
           d.department_name AS "departmentName", jp.position_title AS "positionTitle"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN job_positions jp ON jp.id = e.position_id
     WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: any[] };
  const emp = empRes.rows[0];
  if (!emp) return null;

  const resolvedPeriodId = await resolvePeriodId(db, periodId);
  if (!resolvedPeriodId) return null;

  const periodRes = (await db.execute(sql`
    SELECT period_code AS "periodCode" FROM appraisal_periods WHERE id = ${resolvedPeriodId}::uuid
  `)) as unknown as { rows: any[] };
  const periodCode = periodRes.rows[0]?.periodCode ?? '';

  const kpis = await selectKpisByEmployee(db, employeeId, resolvedPeriodId);
  const rows: KpiPortfolioRow[] = kpis.map((k: any) => ({
    kpiTitle: String(k.kpiTitle ?? ''),
    strategicPillarName: k.strategicPillarName ?? null,
    unit: String(k.unit ?? '%'),
    targetValue: Number(k.targetValue) || 0,
    actualValue: Number(k.actualValue) || 0,
    kpiWeight: Number(k.kpiWeight) || 0,
    achievementPercentage: Number(k.achievementPercentage) || 0,
    status: String(k.status ?? 'DRAFT'),
  }));

  const appraisal = (await selectAppraisalByEmployee(db, employeeId, resolvedPeriodId)) as any;

  return {
    employeeName: emp.fullName ?? '-',
    employeeCode: emp.employeeCode ?? '-',
    departmentName: emp.departmentName ?? null,
    positionTitle: emp.positionTitle ?? null,
    periodId: resolvedPeriodId,
    periodCode,
    kpiScore: appraisal ? Number(appraisal.kpiCompositeScore) || 0 : null,
    totalScore: appraisal ? Number(appraisal.totalPercentageScore) || 0 : null,
    gpa: appraisal ? Number(appraisal.compositeGPA) || 0 : null,
    rating: appraisal ? appraisal.performanceRating ?? null : null,
    rows,
  };
}
