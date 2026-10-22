import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { appendActivity } from './activityFeedService';

export type LetterDirection = 'INCOMING' | 'OUTGOING' | 'DIRECTIVE';
export type LetterClassification = 'BIASA' | 'TERBATAS' | 'RAHASIA';
export type LetterStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type DispositionStatus = 'BELUM_DIBACA' | 'DIBACA' | 'DIKERJAKAN' | 'SELESAI' | 'DITOLAK';

export interface DispositionRow {
  id: string;
  letterId: string;
  fromUserId: string;
  toUserId: string;
  instruction: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  status: DispositionStatus;
  readAt: string | null;
  completedAt: string | null;
  completionNote: string | null;
}

export interface LetterRow {
  id: string;
  agendaNumber: string;
  direction: LetterDirection;
  classification: LetterClassification;
  subject: string;
  sender: string | null;
  recipient: string | null;
  letterDate: string;
  receivedDate: string | null;
  fileUrl: string | null;
  status: LetterStatus;
  createdBy: string | null;
  dispositions?: DispositionRow[];
}

const LETTER_SELECT = sql`
  id, agenda_number AS "agendaNumber", direction, classification, subject,
  sender, recipient, letter_date AS "letterDate", received_date AS "receivedDate",
  file_url AS "fileUrl", status, created_by AS "createdBy"
`;

/** Varian ber-kualifikasi `l.` untuk query yang JOIN letter_dispositions. */
const LETTER_SELECT_QUALIFIED = sql`
  l.id, l.agenda_number AS "agendaNumber", l.direction, l.classification, l.subject,
  l.sender, l.recipient, l.letter_date AS "letterDate", l.received_date AS "receivedDate",
  l.file_url AS "fileUrl", l.status, l.created_by AS "createdBy"
`;

const DISP_SELECT = sql`
  id, letter_id AS "letterId", from_user_id AS "fromUserId", to_user_id AS "toUserId",
  instruction, priority, due_date AS "dueDate", status,
  read_at AS "readAt", completed_at AS "completedAt",
  completion_note AS "completionNote"
`;

export async function registerLetter(
  db: Db,
  input: {
    agendaNumber: string;
    direction: LetterDirection;
    classification: LetterClassification;
    subject: string;
    sender?: string;
    recipient?: string;
    letterDate: string;
    receivedDate?: string;
    fileUrl?: string;
    createdBy: string;
  },
): Promise<LetterRow> {
  const existing = (await db.execute(sql`
    SELECT 1 FROM letters WHERE agenda_number = ${input.agendaNumber}
  `)) as unknown as { rows: unknown[] };
  if (existing.rows?.length) {
    throw new BusinessRuleError(`Nomor agenda '${input.agendaNumber}' sudah dipakai.`);
  }

  const res = (await db.execute(sql`
    INSERT INTO letters
      (agenda_number, direction, classification, subject, sender, recipient,
       letter_date, received_date, file_url, status, created_by)
    VALUES (${input.agendaNumber}, ${input.direction}::letter_direction_enum,
            ${input.classification}::letter_classification_enum, ${input.subject},
            ${input.sender ?? null}, ${input.recipient ?? null},
            ${input.letterDate}::date, ${input.receivedDate ?? null}::date,
            ${input.fileUrl ?? null}, 'OPEN', ${input.createdBy}::uuid)
    RETURNING ${LETTER_SELECT}
  `)) as unknown as { rows: LetterRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Surat gagal didaftarkan.');
  return row;
}

/** Surat + disposisi yang terlihat oleh pengguna tertentu. */
export async function listLetters(db: Db, userId: string): Promise<LetterRow[]> {
  const letters = (await db.execute(sql`
    SELECT DISTINCT ${LETTER_SELECT_QUALIFIED}
      FROM letters l
      LEFT JOIN letter_dispositions d ON d.letter_id = l.id
     WHERE l.created_by = ${userId}::uuid
        OR d.to_user_id = ${userId}::uuid
        OR d.from_user_id = ${userId}::uuid
        OR l.classification = 'BIASA'
     ORDER BY l.letter_date DESC
  `)) as unknown as { rows: LetterRow[] };

  const rows = letters.rows ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const idList = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const dispositions = (await db.execute(sql`
    SELECT ${DISP_SELECT} FROM letter_dispositions
     WHERE letter_id IN (${idList})
     ORDER BY created_at
  `)) as unknown as { rows: DispositionRow[] };

  const byLetter = new Map<string, DispositionRow[]>();
  for (const d of dispositions.rows ?? []) {
    const list = byLetter.get(d.letterId) ?? [];
    list.push(d);
    byLetter.set(d.letterId, list);
  }
  return rows.map((r) => ({ ...r, dispositions: byLetter.get(r.id) ?? [] }));
}

export async function addDisposition(
  db: Db,
  input: {
    letterId: string;
    fromUserId: string;
    toUserId: string;
    instruction: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    dueDate?: string;
  },
): Promise<DispositionRow> {
  if (input.fromUserId === input.toUserId) {
    throw new BusinessRuleError('Disposisi tidak boleh ditujukan kepada diri sendiri.');
  }
  if (input.instruction.trim().length < 5) {
    throw new BusinessRuleError('Instruksi disposisi wajib diisi (minimal 5 karakter).');
  }

  const letter = (await db.execute(sql`
    SELECT status FROM letters WHERE id = ${input.letterId}::uuid
  `)) as unknown as { rows: Array<{ status: LetterStatus }> };
  const status = letter.rows?.[0]?.status;
  if (!status) throw new BusinessRuleError('Surat tidak ditemukan.');
  if (status === 'CLOSED') throw new BusinessRuleError('Surat sudah ditutup.');

  const res = (await db.execute(sql`
    INSERT INTO letter_dispositions
      (letter_id, from_user_id, to_user_id, instruction, priority, due_date)
    VALUES (${input.letterId}::uuid, ${input.fromUserId}::uuid, ${input.toUserId}::uuid,
            ${input.instruction}, ${input.priority ?? 'NORMAL'}, ${input.dueDate ?? null}::date)
    RETURNING ${DISP_SELECT}
  `)) as unknown as { rows: DispositionRow[] };

  await db.execute(sql`
    UPDATE letters SET status = 'IN_PROGRESS'
     WHERE id = ${input.letterId}::uuid AND status = 'OPEN'
  `);

  return res.rows[0];
}

export async function updateDisposition(
  db: Db,
  input: { id: string; userId: string; status: DispositionStatus; note?: string },
): Promise<DispositionRow> {
  const current = (await db.execute(sql`
    SELECT to_user_id AS "toUserId", status FROM letter_dispositions
     WHERE id = ${input.id}::uuid
  `)) as unknown as { rows: Array<{ toUserId: string; status: DispositionStatus }> };

  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Disposisi tidak ditemukan.');
  if (row.toUserId !== input.userId) {
    throw new BusinessRuleError('Hanya penerima disposisi yang dapat memperbarui statusnya.');
  }

  const res = (await db.execute(sql`
    UPDATE letter_dispositions
       SET status = ${input.status}::disposition_status_enum,
           read_at = CASE WHEN ${input.status} <> 'BELUM_DIBACA'
                          THEN COALESCE(read_at, CURRENT_TIMESTAMP) ELSE read_at END,
           completed_at = CASE WHEN ${input.status} IN ('SELESAI', 'DITOLAK')
                               THEN CURRENT_TIMESTAMP ELSE completed_at END,
           completion_note = COALESCE(${input.note ?? null}, completion_note)
     WHERE id = ${input.id}::uuid
    RETURNING ${DISP_SELECT}
  `)) as unknown as { rows: DispositionRow[] };

  return res.rows[0];
}

export async function closeLetter(
  db: Db,
  input: { letterId: string; closedBy: string },
): Promise<LetterRow> {
  const open = (await db.execute(sql`
    SELECT count(*)::int AS n FROM letter_dispositions
     WHERE letter_id = ${input.letterId}::uuid
       AND status IN ('BELUM_DIBACA', 'DIBACA', 'DIKERJAKAN')
  `)) as unknown as { rows: Array<{ n: number }> };

  const pending = Number(open.rows?.[0]?.n ?? 0);
  if (pending > 0) {
    throw new BusinessRuleError(`Surat belum dapat ditutup: ${pending} disposisi belum selesai.`);
  }

  const res = (await db.execute(sql`
    UPDATE letters SET status = 'CLOSED'
     WHERE id = ${input.letterId}::uuid AND status <> 'CLOSED'
    RETURNING ${LETTER_SELECT}
  `)) as unknown as { rows: LetterRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Surat tidak ditemukan atau sudah ditutup.');
  return row;
}

/** Catat aktivitas surat (dipanggil setelah transaksi berhasil). */
export async function notifyLetterEvent(db: Db, employeeId: string, summary: string): Promise<void> {
  await appendActivity(db, { employeeId, eventType: 'LETTER', summary, visibility: 'CONFIDENTIAL' });
}
