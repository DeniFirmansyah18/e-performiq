import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type FinalizationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FinalizationRow {
  id: string;
  periodId: string;
  periodCode: string;
  employeeId: string;
  status: FinalizationStatus;
  note: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export const FINALIZATION_STATUS_LABEL: Record<FinalizationStatus, string> = {
  PENDING: 'Menunggu Persetujuan Atasan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

/** Periode ACTIVE; fallback periode terbaru. */
async function resolvePeriodId(db: Db, requested?: string): Promise<string | null> {
  if (requested) return requested;
  const res = (await db.execute(sql`
    SELECT id FROM appraisal_periods
     WHERE status = 'ACTIVE'::period_status_enum
     ORDER BY start_date DESC LIMIT 1
  `)) as unknown as { rows: any[] };
  if (res.rows[0]) return res.rows[0].id;
  const latest = (await db.execute(sql`
    SELECT id FROM appraisal_periods ORDER BY end_date DESC NULLS LAST LIMIT 1
  `)) as unknown as { rows: any[] };
  return latest.rows[0]?.id ?? null;
}

function fmt(row: any): FinalizationRow {
  return {
    id: row.id,
    periodId: row.periodId,
    periodCode: row.periodCode ?? '',
    employeeId: row.employeeId,
    status: row.status,
    note: row.note ?? null,
    decisionNote: row.decisionNote ?? null,
    decidedAt: row.decidedAt ?? null,
    createdAt: row.createdAt,
  };
}

export async function getFinalizationRequest(
  db: Db,
  employeeId: string,
  periodId?: string
): Promise<FinalizationRow | null> {
  const resolved = await resolvePeriodId(db, periodId);
  if (!resolved) return null;
  const res = (await db.execute(sql`
    SELECT f.id, f.period_id AS "periodId", ap.period_code AS "periodCode",
           f.employee_id AS "employeeId", f.status, f.note,
           f.decision_note AS "decisionNote", f.decided_at AS "decidedAt",
           f.created_at AS "createdAt"
      FROM appraisal_finalization_requests f
      JOIN appraisal_periods ap ON ap.id = f.period_id
     WHERE f.employee_id = ${employeeId}::uuid
       AND f.period_id = ${resolved}::uuid
     LIMIT 1
  `)) as unknown as { rows: any[] };
  return res.rows[0] ? fmt(res.rows[0]) : null;
}

/** Ajukan finalisasi (self-appraisal). Idempoten: baris PENDING/APPROVED tidak dobel. */
export async function submitFinalizationRequest(
  db: Db,
  employeeId: string,
  periodId?: string,
  note?: string
): Promise<FinalizationRow> {
  const resolved = await resolvePeriodId(db, periodId);
  if (!resolved) throw new Error('Tidak ada periode penilaian yang tersedia.');

  const res = (await db.execute(sql`
    INSERT INTO appraisal_finalization_requests (period_id, employee_id, status, note)
    VALUES (${resolved}::uuid, ${employeeId}::uuid, 'PENDING', ${note ?? null})
    ON CONFLICT (period_id, employee_id) DO UPDATE
      SET note = EXCLUDED.note,
          status = CASE
            WHEN appraisal_finalization_requests.status = 'APPROVED' THEN 'APPROVED'
            ELSE 'PENDING'
          END,
          decided_by = CASE
            WHEN appraisal_finalization_requests.status = 'APPROVED' THEN appraisal_finalization_requests.decided_by
            ELSE NULL
          END,
          decided_at = CASE
            WHEN appraisal_finalization_requests.status = 'APPROVED' THEN appraisal_finalization_requests.decided_at
            ELSE NULL
          END,
          updated_at = CURRENT_TIMESTAMP
    RETURNING id, period_id AS "periodId", employee_id AS "employeeId",
              status, note, decision_note AS "decisionNote",
              decided_at AS "decidedAt", created_at AS "createdAt"
  `)) as unknown as { rows: any[] };

  const period = (await db.execute(sql`
    SELECT period_code AS "periodCode" FROM appraisal_periods WHERE id = ${resolved}::uuid
  `)) as unknown as { rows: any[] };
  const row = res.rows[0];
  row.periodCode = period.rows[0]?.periodCode ?? '';
  return fmt(row);
}
