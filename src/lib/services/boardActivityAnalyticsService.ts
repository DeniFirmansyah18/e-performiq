import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { todayInJakarta, addDays } from '@/lib/utils/wibDate';

export interface BoardActivityOptions {
  fromDate?: string;
  toDate?: string;
  eventType?: string;
  departmentId?: string;
  search?: string;
}

export interface BoardActivityAnalytics {
  fromDate: string;
  toDate: string;
  sampleSize: number;
  totalEvents: number;
  byEventType: Array<{ eventType: string; count: number; percentage: number }>;
  byDepartment: Array<{ departmentName: string; count: number }>;
  byOwnerRole: Array<{ role: string; count: number; percentage: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  recent: Array<{
    id: string;
    employeeName: string;
    employeeCode: string;
    departmentName: string;
    eventType: string;
    summary: string;
    occurredAt: string;
  }>;
  analysis: {
    busiestDepartment: string | null;
    busiestEventType: string | null;
    coveragePercentage: number;
    activeEmployees: number;
    highlights: string[];
  };
}

const DEFAULT_WINDOW_DAYS = 14;
const RECENT_LIMIT = 50;

function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export async function getBoardActivityAnalytics(
  db: Db,
  options: BoardActivityOptions = {}
): Promise<BoardActivityAnalytics> {
  const toDate = options.toDate ?? todayInJakarta();
  const fromDate = options.fromDate ?? addDays(toDate, -(DEFAULT_WINDOW_DAYS - 1));

  // Tanggal lokal WIB dipakai agar pengelompokan harian tidak bergeser 7 jam.
  const localDate = sql`(a.occurred_at AT TIME ZONE 'Asia/Jakarta')::date`;

  const filters = sql`
    a.visibility <> 'RESTRICTED'
    AND ${localDate} >= ${fromDate}::date
    AND ${localDate} <= ${toDate}::date
    ${options.eventType ? sql`AND a.event_type::text = ${options.eventType}` : sql``}
    ${options.departmentId ? sql`AND e.department_id = ${options.departmentId}::uuid` : sql``}
    ${
      options.search
        ? sql`AND (e.full_name ILIKE ${`%${options.search}%`}
              OR e.employee_code ILIKE ${`%${options.search}%`}
              OR a.summary ILIKE ${`%${options.search}%`})`
        : sql``
    }
  `;

  const base = sql`
    FROM activity_events a
    JOIN employees e ON e.id = a.employee_id
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN users u ON u.employee_id = a.employee_id
    WHERE ${filters}
  `;

  const [typeRes, deptRes, roleRes, trendRes, recentRes, activeRes, coverageRes] =
    await Promise.all([
      db.execute(sql`
        SELECT a.event_type::text AS "eventType", COUNT(*)::int AS count
        ${base}
        GROUP BY 1
        ORDER BY count DESC, 1 ASC
      `),
      db.execute(sql`
        SELECT d.department_name AS "departmentName", COUNT(*)::int AS count
        ${base}
        GROUP BY 1
        ORDER BY count DESC, 1 ASC
      `),
      db.execute(sql`
        SELECT COALESCE(u.role::text, 'NO_ACCOUNT') AS role, COUNT(*)::int AS count
        ${base}
        GROUP BY 1
        ORDER BY count DESC, 1 ASC
      `),
      db.execute(sql`
        SELECT ${localDate}::text AS date, COUNT(*)::int AS count
        ${base}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      db.execute(sql`
        SELECT a.id, e.full_name AS "employeeName", e.employee_code AS "employeeCode",
               d.department_name AS "departmentName", a.event_type::text AS "eventType",
               a.summary, a.occurred_at AS "occurredAt"
        ${base}
        ORDER BY a.occurred_at DESC
        LIMIT ${RECENT_LIMIT}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS total
          FROM employees
         WHERE status NOT IN ('RESIGNED', 'RETIRED')
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT a.employee_id)::int AS covered
        ${base}
      `),
    ]);

  const typeRows = (typeRes.rows ?? []) as Array<{ eventType: string; count: number }>;
  const deptRows = (deptRes.rows ?? []) as Array<{ departmentName: string; count: number }>;
  const roleRows = (roleRes.rows ?? []) as Array<{ role: string; count: number }>;
  const trendRows = (trendRes.rows ?? []) as Array<{ date: string; count: number }>;
  const recentRows = (recentRes.rows ?? []) as Array<{
    id: string;
    employeeName: string;
    employeeCode: string;
    departmentName: string;
    eventType: string;
    summary: string;
    occurredAt: unknown;
  }>;

  const totalEvents = typeRows.reduce((s, r) => s + Number(r.count), 0);
  const activeEmployees = Number(
    ((activeRes.rows ?? []) as Array<{ total: number }>)[0]?.total ?? 0
  );
  const covered = Number(
    ((coverageRes.rows ?? []) as Array<{ covered: number }>)[0]?.covered ?? 0
  );

  // Lengkapi hari tanpa event agar grafik tren tidak memutus garis.
  const countByDate = new Map(trendRows.map((r) => [String(r.date).slice(0, 10), Number(r.count)]));
  const dailyTrend: Array<{ date: string; count: number }> = [];
  const span = Math.max(
    0,
    Math.round(
      (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000
    )
  );
  for (let i = 0; i <= span; i++) {
    const date = addDays(fromDate, i);
    dailyTrend.push({ date, count: countByDate.get(date) ?? 0 });
  }

  const busiestDepartment = deptRows[0]?.departmentName ?? null;
  const busiestEventType = typeRows[0]?.eventType ?? null;
  const coveragePercentage = percentage(covered, activeEmployees);

  const highlights: string[] = [];
  if (totalEvents === 0) {
    highlights.push('Belum ada aktivitas pada rentang ini.');
  } else {
    highlights.push(
      `${totalEvents} aktivitas tercatat dari ${covered} pegawai (${coveragePercentage}% pegawai aktif).`
    );
    if (busiestDepartment) {
      highlights.push(
        `Departemen paling aktif: ${busiestDepartment} (${deptRows[0].count} aktivitas).`
      );
    }
    if (activeEmployees > covered) {
      highlights.push(`${activeEmployees - covered} pegawai aktif tanpa aktivitas tercatat.`);
    }
  }

  return {
    fromDate,
    toDate,
    sampleSize: totalEvents,
    totalEvents,
    byEventType: typeRows.map((r) => ({
      eventType: r.eventType,
      count: Number(r.count),
      percentage: percentage(Number(r.count), totalEvents),
    })),
    byDepartment: deptRows.map((r) => ({
      departmentName: r.departmentName,
      count: Number(r.count),
    })),
    byOwnerRole: roleRows.map((r) => ({
      role: r.role,
      count: Number(r.count),
      percentage: percentage(Number(r.count), totalEvents),
    })),
    dailyTrend,
    recent: recentRows.map((r) => ({
      id: String(r.id),
      employeeName: r.employeeName,
      employeeCode: r.employeeCode,
      departmentName: r.departmentName,
      eventType: r.eventType,
      summary: r.summary,
      occurredAt: new Date(r.occurredAt as string).toISOString(),
    })),
    analysis: {
      busiestDepartment,
      busiestEventType,
      coveragePercentage,
      activeEmployees,
      highlights,
    },
  };
}
