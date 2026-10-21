import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export interface CorrectionRow {
  id: string;
  attendanceLogId: string;
  employeeId: string;
  requestedCheckInAt: string | null;
  requestedCheckOutAt: string | null;
  reason: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  decisionNote: string | null;
}

const SELECT = sql`
  id, attendance_log_id AS "attendanceLogId", employee_id AS "employeeId",
  requested_check_in_at AS "requestedCheckInAt",
  requested_check_out_at AS "requestedCheckOutAt",
  reason, status, decision_note AS "decisionNote"
`;

export async function requestCorrection(
  db: Db,
  input: {
    attendanceLogId: string;
    employeeId: string;
    requestedCheckInAt?: string;
    requestedCheckOutAt?: string;
    reason: string;
  },
): Promise<CorrectionRow> {
  if (!input.requestedCheckInAt && !input.requestedCheckOutAt) {
    throw new BusinessRuleError('Isi minimal satu jam pengganti (masuk atau keluar).');
  }
  if (input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan koreksi wajib diisi (minimal 5 karakter).');
  }

  const owned = (await db.execute(sql`
    SELECT 1 FROM attendance_logs
     WHERE id = ${input.attendanceLogId}::uuid AND employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: unknown[] };
  if (!owned.rows?.length) {
    throw new BusinessRuleError('Log absensi tidak ditemukan untuk karyawan ini.');
  }

  const res = (await db.execute(sql`
    INSERT INTO attendance_corrections
      (attendance_log_id, employee_id, requested_check_in_at, requested_check_out_at, reason)
    VALUES (${input.attendanceLogId}::uuid, ${input.employeeId}::uuid,
            ${input.requestedCheckInAt ?? null}::timestamptz,
            ${input.requestedCheckOutAt ?? null}::timestamptz, ${input.reason})
    RETURNING ${SELECT}
  `)) as unknown as { rows: CorrectionRow[] };
  return res.rows[0];
}

export async function decideCorrection(
  db: Db,
  input: { id: string; deciderId: string; decision: 'APPROVED' | 'REJECTED'; note?: string },
): Promise<CorrectionRow> {
  const current = (await db.execute(sql`
    SELECT status, attendance_log_id AS "attendanceLogId",
           requested_check_in_at AS "requestedCheckInAt",
           requested_check_out_at AS "requestedCheckOutAt"
      FROM attendance_corrections WHERE id = ${input.id}::uuid
  `)) as unknown as {
    rows: Array<{
      status: string; attendanceLogId: string;
      requestedCheckInAt: string | null; requestedCheckOutAt: string | null;
    }>;
  };

  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Pengajuan koreksi tidak ditemukan.');
  if (row.status !== 'SUBMITTED') {
    throw new BusinessRuleError(`Koreksi sudah diputuskan (${row.status}).`);
  }

  if (input.decision === 'APPROVED') {
    await db.execute(sql`
      UPDATE attendance_logs
         SET check_in_at = COALESCE(${row.requestedCheckInAt ?? null}::timestamptz, check_in_at),
             check_out_at = COALESCE(${row.requestedCheckOutAt ?? null}::timestamptz, check_out_at),
             approved_by = ${input.deciderId}::uuid,
             approved_at = CURRENT_TIMESTAMP
       WHERE id = ${row.attendanceLogId}::uuid
    `);
  }

  const res = (await db.execute(sql`
    UPDATE attendance_corrections
       SET status = ${input.decision}::correction_status_enum,
           decided_by = ${input.deciderId}::uuid,
           decided_at = CURRENT_TIMESTAMP,
           decision_note = ${input.note ?? null}
     WHERE id = ${input.id}::uuid
    RETURNING ${SELECT}
  `)) as unknown as { rows: CorrectionRow[] };
  return res.rows[0];
}
