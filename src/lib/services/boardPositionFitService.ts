import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type FitStatus = 'COMPLIANT' | 'PARTIAL' | 'NOT_COMPLIANT' | 'NO_TEMPLATE';

export interface EmployeeFit {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionId: string;
  positionTitle: string;
  jobGrade: string | null;
  templateKpiCount: number;
  matchedKpiCount: number;
  coveragePercentage: number;
  achievementPercentage: number;
  latestGpa: number | null;
  latestRating: string | null;
  status: FitStatus;
}

export interface PositionFit {
  sampleSize: number;
  byPosition: Array<{
    positionId: string;
    positionTitle: string;
    jobGrade: string | null;
    holders: number;
    compliantHolders: number;
    templateKpiCount: number;
    matchedKpiCount: number;
    coveragePercentage: number;
    achievementPercentage: number;
    status: FitStatus;
  }>;
  employees: EmployeeFit[];
  analysis: {
    compliantPositions: number;
    positionsWithoutTemplate: number;
    averageCoveragePercentage: number;
    highlights: string[];
  };
}

/** Ambang kepatuhan (spec §5). */
const COMPLIANT_COVERAGE = 80;
const PARTIAL_COVERAGE = 50;
const COMPLIANT_ACHIEVEMENT = 100;

function round1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function safeRatio(part: number, total: number, scale = 100): number {
  if (total <= 0) return 0;
  return round1((part / total) * scale);
}

function statusOf(templateCount: number, coverage: number, achievement: number): FitStatus {
  if (templateCount <= 0) return 'NO_TEMPLATE';
  if (coverage >= COMPLIANT_COVERAGE && achievement >= COMPLIANT_ACHIEVEMENT) return 'COMPLIANT';
  if (coverage >= PARTIAL_COVERAGE) return 'PARTIAL';
  return 'NOT_COMPLIANT';
}

export async function getPositionFit(db: Db, _periodCode?: string): Promise<PositionFit> {
  // Kecocokan KPI memakai judul yang dinormalkan (huruf kecil + trim).
  // KPI ganda pada judul yang sama diambil capaian tertinggi agar tidak ambigu.
  const res = (await db.execute(sql`
    WITH tpl AS (
      SELECT t.position_id AS position_id,
             LOWER(TRIM(t.kpi_title)) AS title_lc,
             t.kpi_weight::float8 AS weight
        FROM position_kpi_templates t
       WHERE t.is_active = TRUE
    ),
    tpl_total AS (
      SELECT position_id,
             COUNT(*)::int AS tpl_count,
             SUM(weight)::float8 AS tpl_weight
        FROM tpl
       GROUP BY position_id
    ),
    emp AS (
      SELECT e.id, e.employee_code, e.full_name, e.position_id,
             d.department_name, jp.position_title, jp.job_grade
        FROM employees e
        JOIN departments d ON d.id = e.department_id
        JOIN job_positions jp ON jp.id = e.position_id
       WHERE e.status NOT IN ('RESIGNED', 'RETIRED')
    ),
    emp_kpi AS (
      SELECT ik.employee_id,
             LOWER(TRIM(ik.kpi_title)) AS title_lc,
             MAX(ik.achievement_percentage)::float8 AS ach
        FROM individual_kpis ik
       GROUP BY ik.employee_id, LOWER(TRIM(ik.kpi_title))
    ),
    matched AS (
      SELECT emp.id AS employee_id,
             COUNT(*)::int AS matched_count,
             SUM(tpl.weight)::float8 AS matched_weight,
             SUM(tpl.weight * ek.ach)::float8 AS weighted_ach
        FROM emp
        JOIN tpl ON tpl.position_id = emp.position_id
        JOIN emp_kpi ek ON ek.employee_id = emp.id AND ek.title_lc = tpl.title_lc
       GROUP BY emp.id
    )
    SELECT emp.id AS "employeeId", emp.employee_code AS "employeeCode",
           emp.full_name AS "fullName", emp.department_name AS "departmentName",
           emp.position_id AS "positionId", emp.position_title AS "positionTitle",
           emp.job_grade AS "jobGrade",
           COALESCE(tt.tpl_count, 0)::int AS "templateKpiCount",
           COALESCE(tt.tpl_weight, 0)::float8 AS "templateWeight",
           COALESCE(m.matched_count, 0)::int AS "matchedKpiCount",
           COALESCE(m.matched_weight, 0)::float8 AS "matchedWeight",
           COALESCE(m.weighted_ach, 0)::float8 AS "weightedAchievement",
           (SELECT pa.composite_gpa FROM performance_appraisals pa
             WHERE pa.employee_id = emp.id
             ORDER BY pa.created_at DESC NULLS LAST LIMIT 1)::float8 AS "latestGpa",
           (SELECT pa.performance_rating FROM performance_appraisals pa
             WHERE pa.employee_id = emp.id
             ORDER BY pa.created_at DESC NULLS LAST LIMIT 1) AS "latestRating"
      FROM emp
      LEFT JOIN tpl_total tt ON tt.position_id = emp.position_id
      LEFT JOIN matched m ON m.employee_id = emp.id
     ORDER BY emp.department_name ASC, emp.full_name ASC
  `)) as unknown as {
    rows: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      departmentName: string;
      positionId: string;
      positionTitle: string;
      jobGrade: string | null;
      templateKpiCount: number;
      templateWeight: number;
      matchedKpiCount: number;
      matchedWeight: number;
      weightedAchievement: number;
      latestGpa: number | null;
      latestRating: string | null;
    }>;
  };

  const employees: EmployeeFit[] = (res.rows ?? []).map((r) => {
    const templateKpiCount = Number(r.templateKpiCount);
    const coveragePercentage = safeRatio(Number(r.matchedWeight), Number(r.templateWeight));
    // `achievement_percentage` sudah berupa persen, jadi pembagi bobot tidak
    // dikalikan 100 lagi (Σ w·ach / Σ w sudah dalam persen).
    const achievementPercentage = safeRatio(
      Number(r.weightedAchievement),
      Number(r.matchedWeight),
      1
    );
    return {
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      fullName: r.fullName,
      departmentName: r.departmentName,
      positionId: r.positionId,
      positionTitle: r.positionTitle,
      jobGrade: r.jobGrade,
      templateKpiCount,
      matchedKpiCount: Number(r.matchedKpiCount),
      coveragePercentage,
      achievementPercentage,
      latestGpa: r.latestGpa === null ? null : Number(r.latestGpa),
      latestRating: r.latestRating,
      status: statusOf(templateKpiCount, coveragePercentage, achievementPercentage),
    };
  });

  const grouped = new Map<string, EmployeeFit[]>();
  for (const e of employees) {
    const list = grouped.get(e.positionId) ?? [];
    list.push(e);
    grouped.set(e.positionId, list);
  }

  const byPosition: PositionFit['byPosition'] = Array.from(grouped.entries()).map(([positionId, list]) => {
    const first = list[0];
    const compliantHolders = list.filter((e) => e.status === 'COMPLIANT').length;
    const avgCoverage = round1(
      list.reduce((s, e) => s + e.coveragePercentage, 0) / list.length
    );
    const avgAchievement = round1(
      list.reduce((s, e) => s + e.achievementPercentage, 0) / list.length
    );

    // Status posisi mengikuti sebaran pemegangnya, bukan rata-rata yang bisa
    // menutupi satu pegawai yang sudah memenuhi syarat.
    let status: FitStatus;
    if (first.templateKpiCount <= 0) {
      status = 'NO_TEMPLATE';
    } else if (compliantHolders === list.length) {
      status = 'COMPLIANT';
    } else if (compliantHolders > 0 || list.some((e) => e.status === 'PARTIAL')) {
      status = 'PARTIAL';
    } else {
      status = 'NOT_COMPLIANT';
    }

    return {
      positionId,
      positionTitle: first.positionTitle,
      jobGrade: first.jobGrade,
      holders: list.length,
      compliantHolders,
      templateKpiCount: first.templateKpiCount,
      matchedKpiCount: Math.round(
        list.reduce((s, e) => s + e.matchedKpiCount, 0) / list.length
      ),
      coveragePercentage: avgCoverage,
      achievementPercentage: avgAchievement,
      status,
    };
  });

  const compliantPositions = byPosition.filter((p) => p.status === 'COMPLIANT').length;
  const positionsWithoutTemplate = byPosition.filter((p) => p.status === 'NO_TEMPLATE').length;
  const positionsWithTemplate = byPosition.filter((p) => p.status !== 'NO_TEMPLATE');
  const averageCoveragePercentage =
    positionsWithTemplate.length > 0
      ? round1(
          positionsWithTemplate.reduce((s, p) => s + p.coveragePercentage, 0) /
            positionsWithTemplate.length
        )
      : 0;

  const notCompliant = employees.filter((e) => e.status === 'NOT_COMPLIANT').length;

  const highlights: string[] = [];
  if (employees.length === 0) {
    highlights.push('Belum ada pegawai aktif untuk dievaluasi.');
  } else {
    highlights.push(
      `${compliantPositions} dari ${byPosition.length} posisi sudah sesuai template KPI.`
    );
    if (positionsWithoutTemplate > 0) {
      highlights.push(`${positionsWithoutTemplate} posisi belum memiliki template KPI.`);
    }
    if (notCompliant > 0) {
      highlights.push(
        `${notCompliant} pegawai belum memenuhi KPI template jabatannya (KPI tidak cocok atau di bawah target).`
      );
    }
  }

  return {
    sampleSize: employees.length,
    byPosition,
    employees,
    analysis: {
      compliantPositions,
      positionsWithoutTemplate,
      averageCoveragePercentage,
      highlights,
    },
  };
}
