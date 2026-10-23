import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  computeFlightRisk,
  type RiskBand,
  type RiskFactor,
  type RiskSignals,
} from '@/lib/engines/flightRiskEngine';
import { computeContractDaysRemaining } from './coreHrService';

export interface RiskRow {
  employeeId: string;
  fullName: string;
  departmentName: string;
  attritionScore: number;
  attritionBand: RiskBand;
  burnoutScore: number;
  burnoutBand: RiskBand;
  factors: RiskFactor[];
  snapshotDate: string;
}

const WINDOW_DAYS = 30;

/** Tanggal `offset` hari dari `asOf` (ISO `YYYY-MM-DD`). */
export function shiftDate(asOf: string, offset: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function longestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = dates.slice().sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${sorted[i]}T00:00:00Z`).getTime();
    if (cur - prev === 86400000) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
  }
  return best;
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Mengumpulkan sinyal risiko dari data operasional nyata. Tidak ada isian
 * manual: absensi, lembur, snapshot DPI, dan tanggal masuk karyawan.
 * Cuti sakit dikecualikan dari ketidakhadiran agar sakit yang sah tidak
 * dihitung sebagai sinyal risiko.
 */
export async function collectSignals(db: Db, employeeId: string, asOf: string): Promise<RiskSignals> {
  const from = shiftDate(asOf, -(WINDOW_DAYS - 1));

  const attendance = (await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE is_present = FALSE AND is_sick_leave = FALSE)::int AS "absentDays",
      count(*) FILTER (WHERE is_present = TRUE AND check_in > TIME '08:15')::int AS "lateDays"
    FROM attendance_records
    WHERE employee_id = ${employeeId}::uuid
      AND work_date BETWEEN ${from}::date AND ${asOf}::date
  `)) as unknown as { rows: Array<{ absentDays: number; lateDays: number }> };

  const logs = (await db.execute(sql`
    SELECT work_date::text AS "workDate",
           coalesce(sum(total_overtime_hours), 0)::float8 AS "overtimeHours"
      FROM attendance_logs
     WHERE employee_id = ${employeeId}::uuid
       AND work_date BETWEEN ${from}::date AND ${asOf}::date
     GROUP BY work_date
     ORDER BY work_date
  `)) as unknown as { rows: Array<{ workDate: string; overtimeHours: number }> };

  const dpi = (await db.execute(sql`
    SELECT
      round(avg(dpi_score) FILTER (WHERE dpi_score IS NOT NULL), 2)::float8 AS "avgDpi",
      count(*) FILTER (WHERE traffic_light = 'RED')::int AS "redDays",
      sum(indicators_filled)::int AS "filled",
      sum(indicators_expected)::int AS "expected",
      round(avg(dpi_score) FILTER (
        WHERE dpi_score IS NOT NULL AND snapshot_date > (${asOf}::date - 7)
      ), 2)::float8 AS "recent",
      round(avg(dpi_score) FILTER (
        WHERE dpi_score IS NOT NULL AND snapshot_date <= (${asOf}::date - 7)
      ), 2)::float8 AS "prior"
    FROM daily_performance_snapshots
    WHERE employee_id = ${employeeId}::uuid
      AND snapshot_date BETWEEN ${from}::date AND ${asOf}::date
  `)) as unknown as {
    rows: Array<{ avgDpi: number | null; redDays: number; filled: number | null; expected: number | null; recent: number | null; prior: number | null }>;
  };

  const tenure = (await db.execute(sql`
    SELECT (
      EXTRACT(YEAR FROM age(${asOf}::date, join_date)) * 12
      + EXTRACT(MONTH FROM age(${asOf}::date, join_date))
    )::int AS "months",
    contract_end_date::text AS "contractEndDate"
    FROM employees WHERE id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ months: number; contractEndDate: string | null }> };

  // Sinyal warisan (dipakai bersama `calculateFlightRisk`): nilai 360 dan
  // sisa kontrak PKWT. Tidak tumpang tindih dengan absensi/lembur di atas.
  const peer = (await db.execute(sql`
    SELECT coalesce(avg(average_core_value_score), 4.2)::float8 AS "peerAvg"
      FROM peer_reviews_360 WHERE evaluatee_id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ peerAvg: number }> };

  const a = attendance.rows[0];
  const d = dpi.rows[0];

  const filled = num(d?.filled);
  const expected = num(d?.expected);
  const entryAdherence =
    filled === null || expected === null || expected === 0 ? null : filled / expected;

  const recent = num(d?.recent);
  const prior = num(d?.prior);
  const dpiTrend = recent === null || prior === null ? null : Math.round((recent - prior) * 100) / 100;

  const dates: string[] = [];
  for (let i = 0; i < logs.rows.length; i++) dates.push(logs.rows[i].workDate);

  let overtimeHours30 = 0;
  for (let i = 0; i < logs.rows.length; i++) overtimeHours30 += num(logs.rows[i].overtimeHours) ?? 0;

  return {
    absentDays30: num(a?.absentDays) ?? 0,
    lateDays30: num(a?.lateDays) ?? 0,
    redDays30: num(d?.redDays) ?? 0,
    overtimeHours30: Math.round(overtimeHours30 * 100) / 100,
    longestWorkStreak: longestStreak(dates),
    avgDpi30: num(d?.avgDpi),
    dpiTrend,
    entryAdherence,
    tenureMonths: num(tenure.rows[0]?.months) ?? 0,
    peerReviewAvg: num(peer.rows[0]?.peerAvg) ?? 4.2,
    contractDaysRemaining: computeContractDaysRemaining(tenure.rows[0]?.contractEndDate ?? null, new Date(`${asOf}T00:00:00Z`)),
  };
}

async function employeeLabel(db: Db, employeeId: string) {
  const res = (await db.execute(sql`
    SELECT e.full_name AS "fullName", d.department_name AS "departmentName"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ fullName: string; departmentName: string | null }> };
  return {
    fullName: res.rows[0]?.fullName ?? '',
    departmentName: res.rows[0]?.departmentName ?? '',
  };
}

/** Hitung risiko satu karyawan lalu simpan (upsert) sebagai snapshot harian. */
export async function computeAndStoreRisk(db: Db, employeeId: string, asOf: string): Promise<RiskRow> {
  const signals = await collectSignals(db, employeeId, asOf);
  const result = computeFlightRisk(signals);
  const factors = result.attrition.factors.concat(result.burnout.factors);

  await db.execute(sql`
    INSERT INTO employee_flight_risk_snapshots (
      employee_id, snapshot_date, attrition_score, attrition_band,
      burnout_score, burnout_band, factors
    ) VALUES (
      ${employeeId}::uuid, ${asOf}::date, ${result.attrition.score}, ${result.attrition.band},
      ${result.burnout.score}, ${result.burnout.band}, ${JSON.stringify(factors)}::jsonb
    )
    ON CONFLICT (employee_id, snapshot_date) DO UPDATE SET
      attrition_score = EXCLUDED.attrition_score,
      attrition_band = EXCLUDED.attrition_band,
      burnout_score = EXCLUDED.burnout_score,
      burnout_band = EXCLUDED.burnout_band,
      factors = EXCLUDED.factors,
      computed_at = CURRENT_TIMESTAMP
  `);

  const label = await employeeLabel(db, employeeId);
  return {
    employeeId,
    fullName: label.fullName,
    departmentName: label.departmentName,
    attritionScore: result.attrition.score,
    attritionBand: result.attrition.band,
    burnoutScore: result.burnout.score,
    burnoutBand: result.burnout.band,
    factors,
    snapshotDate: asOf,
  };
}

/** Hitung ulang untuk seluruh karyawan aktif. Idempoten per tanggal. */
export async function recomputeAllRisks(db: Db, asOf: string): Promise<{ processed: number; skipped: number }> {
  const res = (await db.execute(sql`
    SELECT id::text AS id FROM employees WHERE last_working_day IS NULL ORDER BY employee_code
  `)) as unknown as { rows: Array<{ id: string }> };

  let processed = 0;
  let skipped = 0;
  for (let i = 0; i < res.rows.length; i++) {
    try {
      await computeAndStoreRisk(db, res.rows[i].id, asOf);
      processed += 1;
    } catch {
      skipped += 1;
    }
  }
  return { processed, skipped };
}

/** Snapshot terbaru per karyawan, opsional difilter band & departemen. */
export async function listFlightRisk(
  db: Db,
  opts: { band?: RiskBand; departmentId?: string; limit?: number } = {},
): Promise<RiskRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 200);
  const band = opts.band ?? null;
  const departmentId = opts.departmentId ?? null;

  const res = (await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (s.employee_id)
             s.employee_id, s.snapshot_date, s.attrition_score, s.attrition_band,
             s.burnout_score, s.burnout_band, s.factors
        FROM employee_flight_risk_snapshots s
       ORDER BY s.employee_id, s.snapshot_date DESC
    )
    SELECT l.employee_id::text AS "employeeId",
           e.full_name AS "fullName",
           coalesce(d.department_name, '') AS "departmentName",
           l.attrition_score::int AS "attritionScore",
           l.attrition_band AS "attritionBand",
           l.burnout_score::int AS "burnoutScore",
           l.burnout_band AS "burnoutBand",
           l.factors,
           l.snapshot_date::text AS "snapshotDate"
      FROM latest l
      JOIN employees e ON e.id = l.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
     WHERE (${band}::text IS NULL OR l.attrition_band = ${band}::text OR l.burnout_band = ${band}::text)
       AND (${departmentId}::uuid IS NULL OR e.department_id = ${departmentId}::uuid)
     ORDER BY greatest(l.attrition_score, l.burnout_score) DESC, e.full_name
     LIMIT ${limit}
  `)) as unknown as { rows: RiskRow[] };

  return res.rows ?? [];
}
