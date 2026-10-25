import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface EmployeeWorkload {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  entryCount: number;
  /** Kapasitas standar (jam) untuk rentang tanggal yang dianalisis. */
  capacityHours: number;
  workloadIntensityPercentage: number;
  status: 'NO_DATA' | 'UNDER_UTILIZED' | 'OPTIMAL' | 'OVER_UTILIZED';
}

export interface WorkloadSummaryResult {
  fromDate: string | null;
  toDate: string | null;
  capacityHours: number;
  averageHours: number;
  averageIntensity: number;
  overUtilizedCount: number;
  underUtilizedCount: number;
  optimalCount: number;
  noDataCount: number;
  employees: EmployeeWorkload[];
}

/** Jam kerja reguler per hari kerja (40 jam/minggu dibagi 5 hari). */
const HOURS_PER_WORKDAY = 8;
/** Dipakai hanya bila tidak ada satu pun entri timesheet untuk menyimpulkan rentang. */
const FALLBACK_CAPACITY_HOURS = 160;
/** Ambang intensitas relatif terhadap kapasitas rentang (bukan angka jam absolut). */
const OVER_UTILIZED_THRESHOLD = 110; // > 110% setara > 44 jam/minggu
const UNDER_UTILIZED_THRESHOLD = 75; // < 75% setara < 30 jam/minggu

/**
 * Menghitung jumlah hari kerja (Senin-Jumat) dalam rentang inklusif.
 * Perhitungan memakai UTC agar tidak bergeser satu hari karena zona waktu.
 */
function countWorkdays(fromDate: string, toDate: string): number {
  const start = Date.parse(`${fromDate}T00:00:00Z`);
  const end = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;

  let workdays = 0;
  for (let t = start; t <= end; t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) workdays++;
  }
  return workdays;
}

function toDateString(value: unknown): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

export async function calculateWorkloadSummary(
  db: Db,
  options?: { departmentId?: string; fromDate?: string; toDate?: string }
): Promise<WorkloadSummaryResult> {
  const deptFilter = options?.departmentId
    ? sql`AND e.department_id = ${options.departmentId}::uuid`
    : sql``;

  // Rentang eksplisit diutamakan; bila tidak diberikan, pakai rentang data nyata
  // supaya intensitas tidak diukur terhadap periode yang tidak punya entri sama sekali.
  let fromDate = options?.fromDate ?? null;
  let toDate = options?.toDate ?? null;

  if (!fromDate || !toDate) {
    const bounds = (await db.execute(sql`
      SELECT MIN(t.work_date) AS min_date, MAX(t.work_date) AS max_date
        FROM daily_timesheets t
        JOIN employees e ON e.id = t.employee_id
       WHERE TRUE ${deptFilter}
    `)) as unknown as { rows: Array<{ min_date: unknown; max_date: unknown }> };

    fromDate = fromDate ?? toDateString(bounds.rows?.[0]?.min_date);
    toDate = toDate ?? toDateString(bounds.rows?.[0]?.max_date);
  }

  const capacityHours =
    fromDate && toDate ? countWorkdays(fromDate, toDate) * HOURS_PER_WORKDAY : 0;

  const res = (await db.execute(sql`
    SELECT
      e.id AS employee_id,
      e.employee_code,
      e.full_name,
      d.department_name,
      COALESCE(SUM(t.regular_hours), 0)::float8 AS total_regular_hours,
      COALESCE(SUM(t.overtime_hours), 0)::float8 AS total_overtime_hours,
      COUNT(t.id)::int AS entry_count
    FROM employees e
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN daily_timesheets t ON t.employee_id = e.id
      ${fromDate ? sql`AND t.work_date >= ${fromDate}::date` : sql``}
      ${toDate ? sql`AND t.work_date <= ${toDate}::date` : sql``}
    WHERE e.status NOT IN ('RESIGNED', 'RETIRED')
      AND COALESCE(e.employment_status::text, '') NOT IN ('RESIGNED', 'RETIRED')
      ${deptFilter}
    GROUP BY e.id, e.employee_code, e.full_name, d.department_name
    ORDER BY d.department_name, e.full_name
  `)) as unknown as {
    rows: Array<{
      employee_id: string;
      employee_code: string;
      full_name: string;
      department_name: string;
      total_regular_hours: number;
      total_overtime_hours: number;
      entry_count: number;
    }>;
  };

  const rows = res.rows ?? [];
  const effectiveCapacity = capacityHours > 0 ? capacityHours : FALLBACK_CAPACITY_HOURS;

  let sumHours = 0;
  let sumIntensity = 0;
  let employeesWithData = 0;
  let overUtilizedCount = 0;
  let underUtilizedCount = 0;
  let optimalCount = 0;
  let noDataCount = 0;

  const employees: EmployeeWorkload[] = rows.map((r) => {
    const reg = Number(r.total_regular_hours || 0);
    const ot = Number(r.total_overtime_hours || 0);
    const total = reg + ot;
    const entryCount = Number(r.entry_count || 0);

    // Tanpa entri timesheet: intensitas 0% dan TIDAK dikategorikan under-utilized,
    // karena tidak adanya data bukan bukti kurangnya beban kerja (Review Focus #1).
    const intensity = entryCount === 0 ? 0 : Math.round((total / effectiveCapacity) * 100);

    let status: EmployeeWorkload['status'];
    if (entryCount === 0) {
      status = 'NO_DATA';
      noDataCount++;
    } else if (intensity > OVER_UTILIZED_THRESHOLD) {
      status = 'OVER_UTILIZED';
      overUtilizedCount++;
    } else if (intensity < UNDER_UTILIZED_THRESHOLD) {
      status = 'UNDER_UTILIZED';
      underUtilizedCount++;
    } else {
      status = 'OPTIMAL';
      optimalCount++;
    }

    // Rata-rata hanya dari pegawai yang benar-benar punya data tercatat.
    if (entryCount > 0) {
      employeesWithData++;
      sumHours += total;
      sumIntensity += intensity;
    }

    return {
      employeeId: r.employee_id,
      employeeCode: r.employee_code,
      fullName: r.full_name,
      departmentName: r.department_name,
      totalRegularHours: reg,
      totalOvertimeHours: ot,
      totalHours: total,
      entryCount,
      capacityHours: effectiveCapacity,
      workloadIntensityPercentage: intensity,
      status,
    };
  });

  const divisor = employeesWithData || 1;

  return {
    fromDate,
    toDate,
    capacityHours: effectiveCapacity,
    averageHours: Math.round((sumHours / divisor) * 10) / 10,
    averageIntensity: Math.round(sumIntensity / divisor),
    overUtilizedCount,
    underUtilizedCount,
    optimalCount,
    noDataCount,
    employees,
  };
}
