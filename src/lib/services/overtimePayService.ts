import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { OvertimeDayType } from '@/lib/engines/payroll-engine';

export interface PayableOvertimeDay {
  date: string;
  dayType: OvertimeDayType;
  approvedHours: number;
  /** null = tidak ada baris absensi untuk tanggal tersebut. */
  clockedHours: number | null;
  payableHours: number;
}

export interface PayableOvertime {
  totalHours: number;
  workdayHours: number;
  restDayHours: number;
  days: PayableOvertimeDay[];
}

/**
 * Jam lembur yang boleh dibayar dalam satu periode (PRD v2.0 §5.6):
 *  - hanya pengajuan berstatus APPROVED,
 *  - dibayar min(disetujui, aktual) bila ada absensi; bila tidak ada absensi
 *    sama sekali, jam disetujui yang dipakai,
 *  - tanggal Sabtu/Minggu atau terdaftar di company_holidays = REST_DAY.
 */
export async function listPayableOvertime(
  db: Db,
  employeeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<PayableOvertime> {
  const res = (await db.execute(sql`
    SELECT r.work_date AS date,
           r.planned_hours::float8 AS "approvedHours",
           a.total_overtime_hours::float8 AS "clockedHours",
           (EXTRACT(DOW FROM r.work_date) IN (0, 6)
            OR EXISTS (SELECT 1 FROM company_holidays h WHERE h.holiday_date = r.work_date)) AS "isRestDay"
      FROM overtime_requests r
      LEFT JOIN attendance_logs a
        ON a.employee_id = r.employee_id AND a.work_date = r.work_date
     WHERE r.employee_id = ${employeeId}::uuid
       AND r.status = 'APPROVED'
       AND r.work_date BETWEEN ${periodStart}::date AND ${periodEnd}::date
     ORDER BY r.work_date
  `)) as unknown as {
    rows: Array<{
      date: string; approvedHours: number; clockedHours: number | null; isRestDay: boolean;
    }>;
  };

  const days: PayableOvertimeDay[] = (res.rows ?? []).map((r) => {
    const approved = Number(r.approvedHours) || 0;
    const clocked = r.clockedHours === null ? null : Number(r.clockedHours) || 0;
    const payable = clocked === null ? approved : Math.min(approved, clocked);
    return {
      date: String(r.date).slice(0, 10),
      dayType: r.isRestDay ? 'REST_DAY' : 'WORKDAY',
      approvedHours: approved,
      clockedHours: clocked,
      payableHours: Math.max(0, payable),
    };
  });

  const workdayHours = days
    .filter((d) => d.dayType === 'WORKDAY')
    .reduce((s, d) => s + d.payableHours, 0);
  const restDayHours = days
    .filter((d) => d.dayType === 'REST_DAY')
    .reduce((s, d) => s + d.payableHours, 0);

  return {
    totalHours: workdayHours + restDayHours,
    workdayHours,
    restDayHours,
    days,
  };
}
