import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { todayInJakarta } from '@/lib/utils/wibDate';

export { todayInJakarta };

export interface PkwtContractAlert {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  contractStartDate: string | null;
  contractEndDate: string;
  daysRemaining: number;
  urgency: 'EXPIRED' | 'CRITICAL_30' | 'WARNING_60' | 'SAFE';
}

export interface ContractsSummaryResult {
  referenceDate: string;
  totalPkwt: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiredCount: number;
  missingEndDateCount: number;
  alerts: PkwtContractAlert[];
}

/**
 * Jarak hari dihitung pada tingkat tanggal (bukan timestamp) agar tidak
 * menghasilkan selisih off-by-one akibat konversi UTC.
 */
function daysBetween(refDate: string, targetDate: string): number {
  const ref = Date.parse(`${refDate}T00:00:00Z`);
  const target = Date.parse(`${targetDate}T00:00:00Z`);
  if (Number.isNaN(ref) || Number.isNaN(target)) return 0;
  return Math.round((target - ref) / 86_400_000);
}

export async function getContractsSummary(
  db: Db,
  refDate: string = todayInJakarta()
): Promise<ContractsSummaryResult> {
  const res = (await db.execute(sql`
    SELECT
      e.id,
      e.employee_code,
      e.full_name,
      d.department_name,
      p.position_title,
      e.contract_start_date,
      e.contract_end_date
    FROM employees e
    JOIN departments d ON d.id = e.department_id
    JOIN job_positions p ON p.id = e.position_id
    WHERE (
      e.employment_status = 'PKWT'::employment_status_enum
      OR (e.employment_status IS NULL AND e.status = 'CONTRACT'::employee_status_enum)
    )
    ORDER BY e.contract_end_date ASC NULLS LAST
  `)) as unknown as {
    rows: Array<{
      id: string;
      employee_code: string;
      full_name: string;
      department_name: string;
      position_title: string;
      contract_start_date: string | null;
      contract_end_date: string | null;
    }>;
  };

  const rows = res.rows ?? [];
  let expiringIn30Days = 0;
  let expiringIn60Days = 0;
  let expiredCount = 0;
  let missingEndDateCount = 0;

  const alerts: PkwtContractAlert[] = [];

  for (const r of rows) {
    if (!r.contract_end_date) {
      // PKWT tanpa tanggal akhir tidak bisa diberi peringatan, tetapi tetap
      // harus terlihat oleh HRD agar datanya dilengkapi.
      missingEndDateCount++;
      continue;
    }
    const endDate = String(r.contract_end_date).slice(0, 10);
    const daysRemaining = daysBetween(refDate, endDate);

    let urgency: PkwtContractAlert['urgency'];
    if (daysRemaining < 0) {
      urgency = 'EXPIRED';
      expiredCount++;
    } else if (daysRemaining <= 30) {
      urgency = 'CRITICAL_30';
      expiringIn30Days++;
    } else if (daysRemaining <= 60) {
      urgency = 'WARNING_60';
      expiringIn60Days++;
    } else {
      urgency = 'SAFE';
    }

    alerts.push({
      employeeId: r.id,
      employeeCode: r.employee_code,
      fullName: r.full_name,
      departmentName: r.department_name,
      positionTitle: r.position_title,
      contractStartDate: r.contract_start_date
        ? String(r.contract_start_date).slice(0, 10)
        : null,
      contractEndDate: endDate,
      daysRemaining,
      urgency,
    });
  }

  return {
    referenceDate: refDate,
    totalPkwt: rows.length,
    expiringIn30Days,
    expiringIn60Days,
    expiredCount,
    missingEndDateCount,
    alerts,
  };
}

