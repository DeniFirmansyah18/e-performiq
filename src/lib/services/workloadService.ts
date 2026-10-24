import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface EmployeeWorkload {
  employeeId: string;
  fullName: string;
  departmentName: string;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  workloadIntensityPercentage: number;
  status: 'UNDER_UTILIZED' | 'OPTIMAL' | 'OVER_UTILIZED';
}

export interface WorkloadSummaryResult {
  averageHours: number;
  averageIntensity: number;
  overUtilizedCount: number;
  underUtilizedCount: number;
  optimalCount: number;
  employees: EmployeeWorkload[];
}

export async function calculateWorkloadSummary(
  db: Db,
  options?: { departmentId?: string; fromDate?: string; toDate?: string }
): Promise<WorkloadSummaryResult> {
  // Standar jam kerja: 40 jam per minggu, atau 160 jam per bulan
  const STANDARD_CAPACITY = 160;

  let query = sql`
    SELECT
      e.id as employee_id,
      e.full_name,
      d.department_name,
      COALESCE(SUM(t.regular_hours), 0)::float8 as total_regular_hours,
      COALESCE(SUM(t.overtime_hours), 0)::float8 as total_overtime_hours
    FROM employees e
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN daily_timesheets t ON t.employee_id = e.id
      ${options?.fromDate ? sql`AND t.work_date >= ${options.fromDate}::date` : sql``}
      ${options?.toDate ? sql`AND t.work_date <= ${options.toDate}::date` : sql``}
    WHERE e.status NOT IN ('RESIGNED', 'RETIRED')
      ${options?.departmentId ? sql`AND e.department_id = ${options.departmentId}::uuid` : sql``}
    GROUP BY e.id, e.full_name, d.department_name
    ORDER BY d.department_name, e.full_name
  `;

  const res = (await db.execute(query)) as unknown as {
    rows: Array<{
      employee_id: string;
      full_name: string;
      department_name: string;
      total_regular_hours: number;
      total_overtime_hours: number;
    }>;
  };

  const rows = res.rows ?? [];
  let sumHours = 0;
  let sumIntensity = 0;
  let overUtilizedCount = 0;
  let underUtilizedCount = 0;
  let optimalCount = 0;

  const employees: EmployeeWorkload[] = rows.map((r) => {
    const reg = Number(r.total_regular_hours || 0);
    const ot = Number(r.total_overtime_hours || 0);
    const total = reg + ot;

    // Intensity dihitung terhadap standar 160 jam (atau basis aktif entri jika ada rentang)
    const intensity = Math.round((total / STANDARD_CAPACITY) * 100);
    let status: 'UNDER_UTILIZED' | 'OPTIMAL' | 'OVER_UTILIZED' = 'OPTIMAL';

    if (total < 120) {
      status = 'UNDER_UTILIZED';
      underUtilizedCount++;
    } else if (total > 180) {
      status = 'OVER_UTILIZED';
      overUtilizedCount++;
    } else {
      optimalCount++;
    }

    sumHours += total;
    sumIntensity += intensity;

    return {
      employeeId: r.employee_id,
      fullName: r.full_name,
      departmentName: r.department_name,
      totalRegularHours: reg,
      totalOvertimeHours: ot,
      totalHours: total,
      workloadIntensityPercentage: intensity,
      status,
    };
  });

  const count = employees.length || 1;
  const averageHours = Math.round((sumHours / count) * 10) / 10;
  const averageIntensity = Math.round(sumIntensity / count);

  return {
    averageHours,
    averageIntensity,
    overUtilizedCount,
    underUtilizedCount,
    optimalCount,
    employees,
  };
}
