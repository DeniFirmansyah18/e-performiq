import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';

export interface IndicatorRow {
  id: string;
  kpiId: string;
  kpiTitle: string;
  indicatorName: string;
  unit: string;
  target: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  aggregation: 'SUM' | 'AVG' | 'LAST' | 'MAX';
  weight: number;
}

export interface EntryRow {
  id: string;
  indicatorId: string;
  employeeId: string;
  entryDate: string;
  actualValue: number;
  note: string | null;
  evidenceUrl: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  isLate: boolean;
  rejectionReason: string | null;
}

const ENTRY_SELECT = sql`
  id, indicator_id AS "indicatorId", employee_id AS "employeeId",
  entry_date AS "entryDate", actual_value::float8 AS "actualValue",
  note, evidence_url AS "evidenceUrl", status, is_late AS "isLate",
  rejection_reason AS "rejectionReason"
`;

export async function listDailyIndicators(db: Db, employeeId: string): Promise<IndicatorRow[]> {
  const res = (await db.execute(sql`
    SELECT i.id, i.kpi_id AS "kpiId", k.kpi_title AS "kpiTitle",
           i.indicator_name AS "indicatorName", i.unit_of_measure AS unit,
           i.target_value::float8 AS target, i.direction, i.frequency, i.aggregation,
           i.indicator_weight::float8 AS weight
      FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
     WHERE k.employee_id = ${employeeId}::uuid
       AND i.is_active = TRUE
       AND i.frequency = 'DAILY'
     ORDER BY k.kpi_title, i.indicator_name
  `)) as unknown as { rows: IndicatorRow[] };
  return res.rows ?? [];
}

export async function saveEntry(
  db: Db,
  input: {
    employeeId: string;
    indicatorId: string;
    entryDate: string;
    actualValue: number;
    note?: string;
    evidenceUrl?: string;
    submit: boolean;
  },
): Promise<EntryRow> {
  if (!Number.isFinite(input.actualValue) || input.actualValue < 0) {
    throw new BusinessRuleError('Nilai realisasi tidak boleh negatif.');
  }

  // Kepemilikan: indikator harus milik KPI karyawan ini.
  const owner = (await db.execute(sql`
    SELECT 1 FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
     WHERE i.id = ${input.indicatorId}::uuid AND k.employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: unknown[] };
  if (!owner.rows?.length) {
    throw new BusinessRuleError('Indikator tidak ditemukan untuk karyawan ini.');
  }

  // Batas kirim 23.59 waktu kantor; setelah itu ditandai terlambat, bukan ditolak.
  const status = input.submit ? 'SUBMITTED' : 'DRAFT';
  const res = (await db.execute(sql`
    INSERT INTO kpi_daily_entries
      (indicator_id, employee_id, entry_date, actual_value, note, evidence_url, status,
       is_late, submitted_at, updated_at)
    VALUES (${input.indicatorId}::uuid, ${input.employeeId}::uuid, ${input.entryDate}::date,
            ${input.actualValue}, ${input.note ?? null}, ${input.evidenceUrl ?? null},
            ${status}::daily_entry_status_enum,
            ${input.submit} AND (NOW() AT TIME ZONE 'Asia/Jakarta')::time > TIME '23:59',
            CASE WHEN ${input.submit} THEN CURRENT_TIMESTAMP ELSE NULL END,
            CURRENT_TIMESTAMP)
    ON CONFLICT (indicator_id, employee_id, entry_date) DO UPDATE
      SET actual_value = EXCLUDED.actual_value,
          note = EXCLUDED.note,
          evidence_url = EXCLUDED.evidence_url,
          status = CASE
            WHEN kpi_daily_entries.status = 'VERIFIED' THEN kpi_daily_entries.status
            ELSE EXCLUDED.status END,
          is_late = EXCLUDED.is_late,
          submitted_at = COALESCE(EXCLUDED.submitted_at, kpi_daily_entries.submitted_at),
          updated_at = CURRENT_TIMESTAMP
    RETURNING ${ENTRY_SELECT}
  `)) as unknown as { rows: EntryRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Entri harian gagal disimpan.');

  if (input.submit) {
    await appendActivity(db, {
      employeeId: input.employeeId,
      eventType: 'KPI_DAILY',
      entityId: row.id,
      summary: `Mengirim realisasi indikator (${input.actualValue}) untuk ${input.entryDate}`,
    });
  }
  return row;
}

export async function listEntries(
  db: Db,
  employeeId: string,
  from: string,
  to: string,
): Promise<EntryRow[]> {
  const res = (await db.execute(sql`
    SELECT ${ENTRY_SELECT}
      FROM kpi_daily_entries
     WHERE employee_id = ${employeeId}::uuid
       AND entry_date BETWEEN ${from}::date AND ${to}::date
     ORDER BY entry_date DESC
  `)) as unknown as { rows: EntryRow[] };
  return res.rows ?? [];
}

export async function verifyEntry(
  db: Db,
  input: { entryId: string; verifierId: string; decision: 'VERIFIED' | 'REJECTED'; reason?: string },
): Promise<EntryRow> {
  const current = (await db.execute(sql`
    SELECT status FROM kpi_daily_entries WHERE id = ${input.entryId}::uuid
  `)) as unknown as { rows: Array<{ status: string }> };
  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Entri tidak ditemukan.');
  if (row.status === 'VERIFIED' || row.status === 'REJECTED') {
    throw new BusinessRuleError(`Entri sudah final (${row.status}); keputusan tidak dapat diubah.`);
  }
  if (input.decision === 'REJECTED' && !input.reason) {
    throw new BusinessRuleError('Penolakan wajib menyertakan alasan.');
  }

  const res = (await db.execute(sql`
    UPDATE kpi_daily_entries
       SET status = ${input.decision}::daily_entry_status_enum,
           verified_by = ${input.verifierId}::uuid,
           verified_at = CURRENT_TIMESTAMP,
           rejection_reason = ${input.decision === 'REJECTED' ? input.reason! : null},
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${input.entryId}::uuid
    RETURNING ${ENTRY_SELECT}
  `)) as unknown as { rows: EntryRow[] };

  return res.rows[0];
}
