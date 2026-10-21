import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  applyAttendance, classifyDpi, computeDpi,
  type AttendanceSignal, type DpiIndicator, type TrafficLight,
} from '@/lib/engines/dpiEngine';
import { appendActivity } from './activityFeedService';

export interface DpiSettings {
  green: number;
  yellow: number;
  cap: number;
  absenceDemotes: boolean;
}

export interface SnapshotRow {
  employeeId: string;
  date: string;
  score: number | null;
  trafficLight: TrafficLight;
  filled: number;
  expected: number;
  demotionReason: string | null;
  weakest: string | null;
}

export interface RecapRow {
  periodMonth: string;
  daysGreen: number;
  daysYellow: number;
  daysRed: number;
  daysNoData: number;
  avgDpi: number | null;
  entryAdherence: number | null;
}

const DEFAULT_SETTINGS: DpiSettings = { green: 90, yellow: 70, cap: 1.2, absenceDemotes: true };

export async function getDpiSettings(db: Db): Promise<DpiSettings> {
  const res = (await db.execute(sql`
    SELECT green_threshold::float8 AS green, yellow_threshold::float8 AS yellow,
           achievement_cap::float8 AS cap, absence_demotes AS "absenceDemotes"
      FROM company_dpi_settings LIMIT 1
  `)) as unknown as { rows: DpiSettings[] };
  return res.rows?.[0] ?? DEFAULT_SETTINGS;
}

/**
 * Sinyal kehadiran (Ruling R8): baris absensi = PRESENT; cuti disetujui = PRESENT;
 * hari kerja lampau tanpa keduanya = ABSENT; hari ini/besok = PRESENT karena
 * hari belum berakhir.
 */
async function attendanceSignal(db: Db, employeeId: string, date: string): Promise<AttendanceSignal> {
  const log = (await db.execute(sql`
    SELECT check_in_at AS "checkInAt", status
      FROM attendance_logs
     WHERE employee_id = ${employeeId}::uuid AND work_date = ${date}::date
  `)) as unknown as { rows: Array<{ checkInAt: string | null; status: string }> };

  const row = log.rows?.[0];
  if (row?.checkInAt && row.status !== 'REJECTED') return 'PRESENT';
  if (row && !row.checkInAt && row.status === 'REJECTED') return 'ABSENT';

  const leave = (await db.execute(sql`
    SELECT 1 FROM leave_requests
     WHERE employee_id = ${employeeId}::uuid
       AND status = 'APPROVED'
       AND ${date}::date BETWEEN start_date AND end_date
  `)) as unknown as { rows: unknown[] };
  if (leave.rows?.length) return 'PRESENT';

  const past = (await db.execute(sql`
    SELECT ${date}::date < (NOW() AT TIME ZONE 'Asia/Jakarta')::date AS past
  `)) as unknown as { rows: Array<{ past: boolean }> };
  return past.rows?.[0]?.past ? 'ABSENT' : 'PRESENT';
}

export async function computeSnapshot(db: Db, employeeId: string, date: string): Promise<SnapshotRow> {
  const settings = await getDpiSettings(db);

  const rows = (await db.execute(sql`
    SELECT i.id, i.indicator_weight::float8 AS weight,
           i.target_value::float8 AS target,
           e.actual_value::float8 AS actual,
           i.direction
      FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
      LEFT JOIN kpi_daily_entries e
        ON e.indicator_id = i.id
       AND e.employee_id = ${employeeId}::uuid
       AND e.entry_date = ${date}::date
       AND e.status IN ('SUBMITTED', 'VERIFIED')
     WHERE k.employee_id = ${employeeId}::uuid
       AND i.is_active = TRUE
       AND i.frequency = 'DAILY'
  `)) as unknown as {
    rows: Array<{ id: string; weight: number; target: number; actual: number | null; direction: DpiIndicator['direction'] }>;
  };

  const indicators: DpiIndicator[] = (rows.rows ?? []).map((r) => ({
    id: r.id,
    weight: Number(r.weight),
    target: Number(r.target),
    actual: r.actual === null ? null : Number(r.actual),
    direction: r.direction,
  }));

  const result = computeDpi(indicators, settings.cap);
  const base = classifyDpi(result.score, settings.green, settings.yellow);

  const signal = await attendanceSignal(db, employeeId, date);
  const final = applyAttendance(base, signal, settings.absenceDemotes);
  const demoted = final !== base;

  return {
    employeeId,
    date,
    score: result.score,
    trafficLight: final,
    filled: result.filled,
    expected: result.expected,
    demotionReason: demoted ? 'ABSENT_WITHOUT_NOTICE' : null,
    weakest: result.weakest,
  };
}

export async function storeSnapshot(
  db: Db,
  employeeId: string,
  date: string,
  opts: { silent?: boolean } = {},
): Promise<SnapshotRow> {
  const snap = await computeSnapshot(db, employeeId, date);

  await db.execute(sql`
    INSERT INTO daily_performance_snapshots
      (employee_id, snapshot_date, dpi_score, traffic_light,
       indicators_expected, indicators_filled, demotion_reason, computed_at)
    VALUES (${employeeId}::uuid, ${date}::date, ${snap.score},
            ${snap.trafficLight}::traffic_light_enum, ${snap.expected}, ${snap.filled},
            ${snap.demotionReason}, CURRENT_TIMESTAMP)
    ON CONFLICT (employee_id, snapshot_date) DO UPDATE
      SET dpi_score = EXCLUDED.dpi_score,
          traffic_light = EXCLUDED.traffic_light,
          indicators_expected = EXCLUDED.indicators_expected,
          indicators_filled = EXCLUDED.indicators_filled,
          demotion_reason = EXCLUDED.demotion_reason,
          computed_at = CURRENT_TIMESTAMP
  `);

  // Snapshot yang dipicu pengiriman entri tidak menambah baris feed; entri
  // hariannya sudah tercatat sebagai KPI_DAILY.
  if (!opts.silent) {
    await appendActivity(db, {
      employeeId,
      eventType: 'DPI_STATUS',
      summary: `Status ${snap.trafficLight} (DPI ${snap.score ?? '-'}) pada ${date}`,
      occurredAt: `${date}T23:59:00+07:00`,
    });
  }

  return snap;
}

export async function getRecap(
  db: Db,
  employeeId: string,
  period: 'daily' | 'monthly' | 'yearly',
  anchor?: string,
): Promise<RecapRow & { period: string }> {
  if (period === 'daily') {
    const day = anchor ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const snap = await computeSnapshot(db, employeeId, day);
    return {
      period,
      periodMonth: snap.date,
      daysGreen: snap.trafficLight === 'GREEN' ? 1 : 0,
      daysYellow: snap.trafficLight === 'YELLOW' ? 1 : 0,
      daysRed: snap.trafficLight === 'RED' ? 1 : 0,
      daysNoData: snap.trafficLight === 'NO_DATA' ? 1 : 0,
      avgDpi: snap.score,
      entryAdherence: snap.expected > 0 ? snap.filled / snap.expected : null,
    };
  }

  const bucket = period === 'monthly' ? 'month' : 'year';
  const res = (await db.execute(sql`
    SELECT to_char(date_trunc(${bucket}, snapshot_date), 'YYYY-MM-DD') AS "periodMonth",
           count(*) FILTER (WHERE traffic_light = 'GREEN')::int AS "daysGreen",
           count(*) FILTER (WHERE traffic_light = 'YELLOW')::int AS "daysYellow",
           count(*) FILTER (WHERE traffic_light = 'RED')::int AS "daysRed",
           count(*) FILTER (WHERE traffic_light = 'NO_DATA')::int AS "daysNoData",
           round(avg(dpi_score) FILTER (WHERE dpi_score IS NOT NULL), 2)::float8 AS "avgDpi",
           (sum(indicators_filled)::numeric / NULLIF(sum(indicators_expected), 0))::float8 AS "entryAdherence"
      FROM daily_performance_snapshots
     WHERE employee_id = ${employeeId}::uuid
       AND date_trunc(${bucket}, snapshot_date)
           = date_trunc(${bucket}, COALESCE(${anchor ?? null}::date, CURRENT_DATE))
     GROUP BY 1
  `)) as unknown as { rows: RecapRow[] };

  const row = res.rows?.[0];
  return {
    period,
    periodMonth: row?.periodMonth ?? '',
    daysGreen: Number(row?.daysGreen ?? 0),
    daysYellow: Number(row?.daysYellow ?? 0),
    daysRed: Number(row?.daysRed ?? 0),
    daysNoData: Number(row?.daysNoData ?? 0),
    avgDpi: row?.avgDpi ?? null,
    entryAdherence: row?.entryAdherence ?? null,
  };
}

/**
 * Rollup entri terkirim/terverifikasi dalam satu periode ke
 * individual_kpis.actual_value (Ruling R9): rasio capaian tiap indikator
 * dirata-ratakan berbobot, lalu diskalakan ke target KPI. Idempoten.
 */
export async function rollupPeriod(db: Db, employeeId: string, periodId: string): Promise<{ updated: number }> {
  const rows = (await db.execute(sql`
    SELECT i.kpi_id AS "kpiId",
           k.target_value::float8 AS "kpiTarget",
           i.indicator_weight::float8 AS weight,
           i.target_value::float8 AS target,
           i.direction,
           SUM(CASE i.aggregation
                 WHEN 'SUM'  THEN e.total
                 WHEN 'AVG'  THEN e.total / NULLIF(e.n, 0)
                 WHEN 'MAX'  THEN e.max_value
                 WHEN 'LAST' THEN e.last_value
               END)::float8 AS "periodValue"
      FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
      JOIN (
        SELECT indicator_id,
               sum(actual_value) AS total,
               count(*) AS n,
               max(actual_value) AS max_value,
               (array_agg(actual_value ORDER BY entry_date DESC))[1] AS last_value
          FROM kpi_daily_entries
         WHERE employee_id = ${employeeId}::uuid
           AND status IN ('SUBMITTED', 'VERIFIED')
           AND entry_date >= (SELECT start_date FROM appraisal_periods WHERE id = ${periodId}::uuid)
           AND entry_date <= (SELECT end_date FROM appraisal_periods WHERE id = ${periodId}::uuid)
         GROUP BY indicator_id
      ) e ON e.indicator_id = i.id
     WHERE i.is_active = TRUE
     GROUP BY i.kpi_id, k.target_value, i.id, i.indicator_weight, i.target_value, i.direction
  `)) as unknown as {
    rows: Array<{
      kpiId: string; kpiTarget: number; weight: number; target: number;
      direction: 'HIGHER_BETTER' | 'LOWER_BETTER'; periodValue: number | null;
    }>;
  };

  const byKpi = new Map<string, { target: number; weighted: number; weightSum: number }>();
  for (const r of rows.rows ?? []) {
    if (r.periodValue === null || Number(r.target) <= 0 || Number(r.weight) <= 0) continue;
    const ratio = r.direction === 'HIGHER_BETTER'
      ? Number(r.periodValue) / Number(r.target)
      : Number(r.target) / Math.max(Number(r.periodValue), 0.01);
    const entry = byKpi.get(r.kpiId) ?? { target: Number(r.kpiTarget), weighted: 0, weightSum: 0 };
    entry.weighted += Number(r.weight) * ratio;
    entry.weightSum += Number(r.weight);
    byKpi.set(r.kpiId, entry);
  }

  let updated = 0;
  const entries = Array.from(byKpi.entries());
  for (const [kpiId, agg] of entries) {
    if (agg.weightSum === 0) continue;
    const actual = agg.target * (agg.weighted / agg.weightSum);
    await db.execute(sql`
      UPDATE individual_kpis
         SET actual_value = ${Math.round(actual * 100) / 100}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ${kpiId}::uuid AND employee_id = ${employeeId}::uuid
    `);
    updated += 1;
  }
  return { updated };
}

export async function listTeamStatus(
  db: Db,
  managerEmployeeId: string,
  date: string,
): Promise<SnapshotRow[]> {
  const res = (await db.execute(sql`
    WITH RECURSIVE reports AS (
      SELECT id FROM employees WHERE manager_id = ${managerEmployeeId}::uuid
      UNION
      SELECT e.id FROM employees e JOIN reports r ON e.manager_id = r.id
    )
    SELECT s.employee_id AS "employeeId", s.snapshot_date AS date,
           s.dpi_score::float8 AS score, s.traffic_light AS "trafficLight",
           s.indicators_filled AS filled, s.indicators_expected AS expected,
           s.demotion_reason AS "demotionReason"
      FROM daily_performance_snapshots s
      JOIN reports r ON r.id = s.employee_id
      JOIN employees e ON e.id = s.employee_id
     WHERE s.snapshot_date = ${date}::date
     ORDER BY s.traffic_light, e.full_name
  `)) as unknown as { rows: SnapshotRow[] };
  return res.rows ?? [];
}
