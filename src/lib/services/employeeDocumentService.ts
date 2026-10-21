import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export interface DocumentRow {
  id: string;
  employeeId: string;
  documentType: string;
  fileUrl: string;
  issuedDate: string | null;
  expiryDate: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  verifiedAt: string | null;
}

const SELECT = sql`
  id, employee_id AS "employeeId", document_type AS "documentType",
  file_url AS "fileUrl", issued_date AS "issuedDate", expiry_date AS "expiryDate",
  verification_status AS "verificationStatus", verified_at AS "verifiedAt"
`;

const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];

/** Dipakai route (Zod refine → 400) dan service (guard → 422) agar satu sumber aturan. */
export function isAllowedDocumentUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase();
  return ALLOWED_EXT.some((ext) => path.endsWith(ext));
}

export async function listDocuments(db: Db, employeeId: string): Promise<DocumentRow[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT} FROM employee_documents
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY created_at DESC
  `)) as unknown as { rows: DocumentRow[] };
  return res.rows ?? [];
}

export async function addDocument(
  db: Db,
  input: {
    employeeId: string;
    documentType: string;
    fileUrl: string;
    issuedDate?: string;
    expiryDate?: string;
  },
): Promise<DocumentRow> {
  const path = input.fileUrl.split('?')[0].toLowerCase();
  if (!isAllowedDocumentUrl(path)) {
    throw new BusinessRuleError('Berkas harus PDF, JPG, atau PNG.');
  }
  if (input.expiryDate && input.issuedDate && input.expiryDate < input.issuedDate) {
    throw new BusinessRuleError('Tanggal kedaluwarsa tidak boleh sebelum tanggal terbit.');
  }

  // Ruling R3: tidak menulis activity_events — enum belum punya tipe DOCUMENT,
  // dan melabelinya TRAINING akan merusak feed.
  const res = (await db.execute(sql`
    INSERT INTO employee_documents
      (employee_id, document_type, file_url, issued_date, expiry_date, verification_status)
    VALUES (${input.employeeId}::uuid, ${input.documentType}, ${input.fileUrl},
            ${input.issuedDate ?? null}::date, ${input.expiryDate ?? null}::date, 'PENDING')
    RETURNING ${SELECT}
  `)) as unknown as { rows: DocumentRow[] };

  return res.rows[0];
}

export async function verifyDocument(
  db: Db,
  input: { id: string; verifierId: string; decision: 'VERIFIED' | 'REJECTED' },
): Promise<DocumentRow> {
  const res = (await db.execute(sql`
    UPDATE employee_documents
       SET verification_status = ${input.decision},
           verified_by = ${input.verifierId}::uuid,
           verified_at = CURRENT_TIMESTAMP
     WHERE id = ${input.id}::uuid AND verification_status = 'PENDING'
    RETURNING ${SELECT}
  `)) as unknown as { rows: DocumentRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Berkas tidak ditemukan atau sudah diverifikasi.');
  return row;
}
