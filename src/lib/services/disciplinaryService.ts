import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';
import { logAction } from './auditService';

export type DisciplinaryType = 'TEGURAN' | 'SP1' | 'SP2' | 'SP3';
export type AppealStatus = 'NONE' | 'UNDER_APPEAL' | 'APPEAL_ACCEPTED' | 'APPEAL_REJECTED';

export interface DisciplinaryRow {
  id: string;
  employeeId: string;
  actionType: DisciplinaryType;
  reason: string;
  evidenceUrl: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  appealStatus: AppealStatus;
  appealDeadline: string;
  appealReason: string | null;
}

export interface RecognitionRow {
  id: string;
  employeeId: string;
  recognitionType: string;
  title: string;
  description: string | null;
  awardedDate: string;
  certificateUrl: string | null;
  points: number;
}

const DISC_SELECT = sql`
  id, employee_id AS "employeeId", action_type AS "actionType", reason,
  evidence_url AS "evidenceUrl", effective_date AS "effectiveDate",
  expiry_date AS "expiryDate", appeal_status AS "appealStatus",
  appeal_deadline AS "appealDeadline", appeal_reason AS "appealReason"
`;

const REC_SELECT = sql`
  id, employee_id AS "employeeId", recognition_type AS "recognitionType",
  title, description, awarded_date AS "awardedDate",
  certificate_url AS "certificateUrl", points
`;

export async function listDisciplinary(db: Db, employeeId: string): Promise<DisciplinaryRow[]> {
  const res = (await db.execute(sql`
    SELECT ${DISC_SELECT} FROM disciplinary_actions
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY effective_date DESC
  `)) as unknown as { rows: DisciplinaryRow[] };
  return res.rows ?? [];
}

export async function issueDisciplinary(
  db: Db,
  input: {
    employeeId: string;
    actionType: DisciplinaryType;
    reason: string;
    evidenceUrl?: string;
    effectiveDate: string;
    expiryDate?: string;
    issuedBy: string;
  },
): Promise<DisciplinaryRow> {
  if (input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan sanksi wajib diisi (minimal 5 karakter).');
  }
  if (input.expiryDate && input.expiryDate < input.effectiveDate) {
    throw new BusinessRuleError('Masa berlaku tidak boleh berakhir sebelum tanggal efektif.');
  }

  const res = (await db.execute(sql`
    INSERT INTO disciplinary_actions
      (employee_id, action_type, reason, evidence_url, effective_date, expiry_date,
       issued_by, appeal_deadline)
    VALUES (${input.employeeId}::uuid, ${input.actionType}::disciplinary_type_enum,
            ${input.reason}, ${input.evidenceUrl ?? null}, ${input.effectiveDate}::date,
            ${input.expiryDate ?? null}::date, ${input.issuedBy}::uuid,
            ${input.effectiveDate}::date + INTERVAL '5 days')
    RETURNING ${DISC_SELECT}
  `)) as unknown as { rows: DisciplinaryRow[] };

  const row = res.rows[0];
  await appendActivity(db, {
    employeeId: input.employeeId,
    eventType: 'DISCIPLINARY',
    entityId: row.id,
    summary: `${input.actionType} diterbitkan (${input.effectiveDate})`,
    visibility: 'CONFIDENTIAL',
  });

  await logAction(db, {
    userId: input.issuedBy,
    actionType: 'CREATE',
    entityName: 'disciplinary_actions',
    recordId: row.id,
    newData: { employeeId: input.employeeId, actionType: input.actionType, effectiveDate: input.effectiveDate },
    description: `Menerbitkan ${input.actionType} untuk karyawan ${input.employeeId}`,
  });

  return row;
}

export async function fileAppeal(
  db: Db,
  input: { id: string; employeeId: string; reason: string },
): Promise<DisciplinaryRow> {
  if (input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan keberatan wajib diisi (minimal 5 karakter).');
  }

  const current = (await db.execute(sql`
    SELECT appeal_status AS "appealStatus", appeal_deadline AS "appealDeadline"
      FROM disciplinary_actions
     WHERE id = ${input.id}::uuid AND employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: Array<{ appealStatus: AppealStatus; appealDeadline: string }> };

  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Sanksi tidak ditemukan untuk karyawan ini.');
  if (row.appealStatus !== 'NONE') {
    throw new BusinessRuleError(`Keberatan sudah diajukan (status ${row.appealStatus}).`);
  }

  const deadline = new Date(`${String(row.appealDeadline).slice(0, 10)}T23:59:59+07:00`);
  if (Date.now() > deadline.getTime()) {
    throw new BusinessRuleError('Tenggat keberatan (5 hari kerja) sudah lewat.');
  }

  const res = (await db.execute(sql`
    UPDATE disciplinary_actions
       SET appeal_status = 'UNDER_APPEAL', appeal_reason = ${input.reason}
     WHERE id = ${input.id}::uuid
    RETURNING ${DISC_SELECT}
  `)) as unknown as { rows: DisciplinaryRow[] };
  return res.rows[0];
}

export async function listRecognitions(db: Db, employeeId: string): Promise<RecognitionRow[]> {
  const res = (await db.execute(sql`
    SELECT ${REC_SELECT} FROM recognitions
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY awarded_date DESC
  `)) as unknown as { rows: RecognitionRow[] };
  return res.rows ?? [];
}

export async function awardRecognition(
  db: Db,
  input: {
    employeeId: string;
    recognitionType: string;
    title: string;
    description?: string;
    awardedDate: string;
    certificateUrl?: string;
    points?: number;
  },
): Promise<RecognitionRow> {
  const res = (await db.execute(sql`
    INSERT INTO recognitions
      (employee_id, recognition_type, title, description, awarded_date, certificate_url, points)
    VALUES (${input.employeeId}::uuid, ${input.recognitionType}, ${input.title},
            ${input.description ?? null}, ${input.awardedDate}::date,
            ${input.certificateUrl ?? null}, ${input.points ?? 0})
    RETURNING ${REC_SELECT}
  `)) as unknown as { rows: RecognitionRow[] };

  const row = res.rows[0];
  await appendActivity(db, {
    employeeId: input.employeeId,
    eventType: 'RECOGNITION',
    entityId: row.id,
    summary: `Menerima penghargaan: ${input.title}`,
  });
  return row;
}

/* ------------------------------------------------------------------ */
/* Panel HR                                                            */
/* ------------------------------------------------------------------ */

export interface HrDisciplinaryRow extends DisciplinaryRow {
  employeeCode: string;
  employeeName: string;
  issuedByName: string | null;
}

/** Daftar sanksi lintas karyawan untuk HR. */
export async function listAllDisciplinary(
  db: Db,
  filter: { employeeId?: string; appealStatus?: AppealStatus } = {},
): Promise<HrDisciplinaryRow[]> {
  const res = (await db.execute(sql`
    SELECT a.id, a.employee_id AS "employeeId", a.action_type AS "actionType", a.reason,
           a.evidence_url AS "evidenceUrl", a.effective_date AS "effectiveDate",
           a.expiry_date AS "expiryDate", a.appeal_status AS "appealStatus",
           a.appeal_deadline AS "appealDeadline", a.appeal_reason AS "appealReason",
           e.employee_code AS "employeeCode", e.full_name AS "employeeName",
           u.email AS "issuedByName"
      FROM disciplinary_actions a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users u ON u.id = a.issued_by
     WHERE (${filter.employeeId ?? null}::uuid IS NULL OR a.employee_id = ${filter.employeeId ?? null}::uuid)
       AND (${filter.appealStatus ?? null}::text IS NULL OR a.appeal_status = ${filter.appealStatus ?? null})
     ORDER BY a.effective_date DESC, a.created_at DESC
  `)) as unknown as { rows: HrDisciplinaryRow[] };
  return res.rows ?? [];
}

/**
 * Keputusan HR atas keberatan karyawan. Hanya berlaku saat status UNDER_APPEAL;
 * catatan sanksi tidak dihapus, hanya statusnya berubah.
 */
export async function decideAppeal(
  db: Db,
  input: { id: string; decision: 'APPEAL_ACCEPTED' | 'APPEAL_REJECTED'; note: string },
): Promise<DisciplinaryRow> {
  if (input.note.trim().length < 5) {
    throw new BusinessRuleError('Catatan keputusan wajib diisi (minimal 5 karakter).');
  }

  const current = (await db.execute(sql`
    SELECT appeal_status AS "appealStatus" FROM disciplinary_actions WHERE id = ${input.id}::uuid
  `)) as unknown as { rows: Array<{ appealStatus: AppealStatus }> };

  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Sanksi tidak ditemukan.');
  if (row.appealStatus !== 'UNDER_APPEAL') {
    throw new BusinessRuleError(
      `Tidak ada keberatan yang menunggu keputusan (status ${row.appealStatus}).`,
    );
  }

  const res = (await db.execute(sql`
    UPDATE disciplinary_actions
       SET appeal_status = ${input.decision}::appeal_status_enum,
           appeal_reason = COALESCE(appeal_reason, '') || E'\n[keputusan HR] ' || ${input.note}
     WHERE id = ${input.id}::uuid
    RETURNING ${DISC_SELECT}
  `)) as unknown as { rows: DisciplinaryRow[] };
  return res.rows[0];
}
