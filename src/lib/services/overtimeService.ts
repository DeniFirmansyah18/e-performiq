import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';

export type OvertimeStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface OvertimeRow {
  id: string;
  employeeId: string;
  workDate: string;
  plannedHours: number;
  reason: string;
  status: OvertimeStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
}

const SELECT = sql`
  id, employee_id AS "employeeId", work_date AS "workDate",
  planned_hours::float8 AS "plannedHours", reason, status,
  approved_by AS "approvedBy", approved_at AS "approvedAt",
  rejection_reason AS "rejectionReason"
`;

const jakartaToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

/** Sabtu/Minggu atau terdaftar di company_holidays. */
export async function isRestDay(db: Db, workDate: string): Promise<boolean> {
  const res = (await db.execute(sql`
    SELECT (EXTRACT(DOW FROM ${workDate}::date) IN (0, 6)
            OR EXISTS (SELECT 1 FROM company_holidays h WHERE h.holiday_date = ${workDate}::date)) AS "isRest"
  `)) as unknown as { rows: Array<{ isRest: boolean }> };
  return Boolean(res.rows?.[0]?.isRest);
}

/** Batas sah jam lembur: 4 jam hari kerja, 10 jam hari libur (UU). */
export function maxOvertimeHours(restDay: boolean): number {
  return restDay ? 10 : 4;
}

export async function requestOvertime(
  db: Db,
  input: { employeeId: string; workDate: string; plannedHours: number; reason: string },
): Promise<OvertimeRow> {
  if (input.workDate < jakartaToday()) {
    throw new BusinessRuleError('Lembur harus diajukan sebelum tanggal pelaksanaan.');
  }

  const restDay = await isRestDay(db, input.workDate);
  const limit = maxOvertimeHours(restDay);
  if (!(input.plannedHours > 0 && input.plannedHours <= limit)) {
    throw new BusinessRuleError(
      restDay
        ? 'Jam lembur hari libur harus lebih dari 0 dan maksimal 10 jam.'
        : 'Jam lembur hari kerja harus lebih dari 0 dan maksimal 4 jam.',
    );
  }
  if (input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan lembur wajib diisi (minimal 5 karakter).');
  }

  const res = (await db.execute(sql`
    INSERT INTO overtime_requests (employee_id, work_date, planned_hours, reason, status)
    VALUES (${input.employeeId}::uuid, ${input.workDate}::date,
            ${input.plannedHours}, ${input.reason}, 'SUBMITTED')
    ON CONFLICT (employee_id, work_date) DO NOTHING
    RETURNING ${SELECT}
  `)) as unknown as { rows: OvertimeRow[] };

  const row = res.rows?.[0];
  if (!row) {
    throw new BusinessRuleError('Sudah ada pengajuan lembur untuk tanggal tersebut.');
  }

  await appendActivity(db, {
    employeeId: input.employeeId,
    eventType: 'OVERTIME',
    entityId: row.id,
    summary: `Mengajukan lembur ${input.plannedHours} jam pada ${input.workDate}`,
  });
  return row;
}

export async function listOvertime(db: Db, employeeId: string): Promise<OvertimeRow[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT} FROM overtime_requests
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY work_date DESC
  `)) as unknown as { rows: OvertimeRow[] };
  return res.rows ?? [];
}

export async function listPendingOvertime(db: Db): Promise<OvertimeRow[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT} FROM overtime_requests
     WHERE status = 'SUBMITTED' ORDER BY work_date
  `)) as unknown as { rows: OvertimeRow[] };
  return res.rows ?? [];
}

export async function decideOvertime(
  db: Db,
  input: { id: string; approverId: string; decision: 'APPROVED' | 'REJECTED'; reason?: string },
): Promise<OvertimeRow> {
  if (input.decision === 'REJECTED' && !input.reason) {
    throw new BusinessRuleError('Penolakan lembur wajib menyertakan alasan.');
  }

  const res = (await db.execute(sql`
    UPDATE overtime_requests
       SET status = ${input.decision}::overtime_status_enum,
           approved_by = ${input.approverId}::uuid,
           approved_at = CURRENT_TIMESTAMP,
           rejection_reason = ${input.decision === 'REJECTED' ? input.reason! : null}
     WHERE id = ${input.id}::uuid AND status = 'SUBMITTED'
    RETURNING ${SELECT}
  `)) as unknown as { rows: OvertimeRow[] };

  const row = res.rows?.[0];
  if (!row) {
    throw new BusinessRuleError('Pengajuan tidak ditemukan atau sudah diputuskan.');
  }

  await appendActivity(db, {
    employeeId: row.employeeId,
    eventType: 'OVERTIME',
    entityId: row.id,
    summary: `Lembur ${row.workDate} ${input.decision === 'APPROVED' ? 'disetujui' : 'ditolak'}`,
  });
  return row;
}
