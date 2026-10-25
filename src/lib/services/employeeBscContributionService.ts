import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/**
 * Kontribusi seorang karyawan terhadap pilar strategis perusahaan (BSC).
 * Narasi 3 pilar 7: menghubungkan performa individual ke sasaran korporat.
 *
 * Rantai data: individual_kpis.strategic_pillar_id -> strategic_pillars.
 * Tidak ada angka contoh; bila belum ada KPI, hasilnya kosong dan
 * `hasKpi` bernilai false agar UI tidak menyimpulkan performa dari ketiadaan data.
 */

export interface PillarContribution {
  pillarId: string;
  pillarName: string;
  perspective: string;
  strategicWeight: number;
  kpiCount: number;
  totalWeight: number;
  /** Rata-rata capaian tertimbang KPI karyawan pada pilar ini (persen). */
  achievementPercentage: number;
}

export interface EmployeeBscContribution {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  departmentName: string;
  positionTitle: string;
  jobGrade: string | null;
  employmentStatus: string | null;
  latestGpa: number | null;
  latestRating: string | null;
  nineBoxQuadrant: string | null;
  hasKpi: boolean;
  pillars: PillarContribution[];
}

export async function getEmployeeBscContribution(
  db: Db,
  employeeId: string
): Promise<EmployeeBscContribution> {
  const empRes = (await db.execute(sql`
    SELECT
      e.id,
      e.employee_code,
      e.full_name,
      d.department_name,
      p.position_title,
      p.job_grade,
      e.employment_status::text AS employment_status,
      (
        SELECT pa.composite_gpa
          FROM performance_appraisals pa
         WHERE pa.employee_id = e.id
         ORDER BY pa.created_at DESC NULLS LAST
         LIMIT 1
      )::float8 AS latest_gpa,
      (
        SELECT pa.performance_rating
          FROM performance_appraisals pa
         WHERE pa.employee_id = e.id
         ORDER BY pa.created_at DESC NULLS LAST
         LIMIT 1
      ) AS latest_rating,
      (
        SELECT pa.nine_box_quadrant::text
          FROM performance_appraisals pa
         WHERE pa.employee_id = e.id
         ORDER BY pa.created_at DESC NULLS LAST
         LIMIT 1
      ) AS nine_box_quadrant
    FROM employees e
    JOIN departments d ON d.id = e.department_id
    JOIN job_positions p ON p.id = e.position_id
    WHERE e.id = ${employeeId}::uuid
  `)) as unknown as {
    rows: Array<{
      id: string;
      employee_code: string;
      full_name: string;
      department_name: string;
      position_title: string;
      job_grade: string | null;
      employment_status: string | null;
      latest_gpa: number | null;
      latest_rating: string | null;
      nine_box_quadrant: string | null;
    }>;
  };

  const emp = empRes.rows?.[0];
  if (!emp) {
    throw new Error('Karyawan tidak ditemukan.');
  }

  const pillarRes = (await db.execute(sql`
    SELECT
      sp.id AS pillar_id,
      sp.pillar_name,
      sp.perspective::text AS perspective,
      sp.strategic_weight::float8 AS strategic_weight,
      COUNT(ik.id)::int AS kpi_count,
      COALESCE(SUM(ik.kpi_weight), 0)::float8 AS total_weight,
      CASE
        WHEN COALESCE(SUM(ik.kpi_weight), 0) > 0
        THEN (SUM(ik.achievement_percentage * ik.kpi_weight) / SUM(ik.kpi_weight))::float8
        ELSE 0
      END AS achievement_percentage
    FROM individual_kpis ik
    JOIN strategic_pillars sp ON sp.id = ik.strategic_pillar_id
    WHERE ik.employee_id = ${employeeId}::uuid
    GROUP BY sp.id, sp.pillar_name, sp.perspective, sp.strategic_weight
    ORDER BY sp.strategic_weight DESC
  `)) as unknown as {
    rows: Array<{
      pillar_id: string;
      pillar_name: string;
      perspective: string;
      strategic_weight: number;
      kpi_count: number;
      total_weight: number;
      achievement_percentage: number;
    }>;
  };

  const pillars: PillarContribution[] = (pillarRes.rows ?? []).map((row) => ({
    pillarId: row.pillar_id,
    pillarName: row.pillar_name,
    perspective: row.perspective,
    strategicWeight: Number(row.strategic_weight),
    kpiCount: Number(row.kpi_count),
    totalWeight: Number(row.total_weight),
    achievementPercentage: Math.round(Number(row.achievement_percentage) * 10) / 10,
  }));

  return {
    employeeId: emp.id,
    fullName: emp.full_name,
    employeeCode: emp.employee_code,
    departmentName: emp.department_name,
    positionTitle: emp.position_title,
    jobGrade: emp.job_grade,
    employmentStatus: emp.employment_status,
    latestGpa: emp.latest_gpa === null ? null : Number(emp.latest_gpa),
    latestRating: emp.latest_rating,
    nineBoxQuadrant: emp.nine_box_quadrant,
    hasKpi: pillars.length > 0,
    pillars,
  };
}