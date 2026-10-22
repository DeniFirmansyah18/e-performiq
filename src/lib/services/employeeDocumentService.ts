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

export interface HrDocumentRow extends DocumentRow {
  employeeCode: string;
  employeeName: string;
  verifiedByName: string | null;
}

/** Antrean/daftar berkas untuk HR, lengkap dengan nama karyawan. */
export async function listDocumentsForHr(
  db: Db,
  filter: { status?: DocumentRow['verificationStatus']; employeeId?: string } = {},
): Promise<HrDocumentRow[]> {
  const res = (await db.execute(sql`
    SELECT d.id, d.employee_id AS "employeeId", d.document_type AS "documentType",
           d.file_url AS "fileUrl", d.issued_date AS "issuedDate", d.expiry_date AS "expiryDate",
           d.verification_status AS "verificationStatus", d.verified_at AS "verifiedAt",
           e.employee_code AS "employeeCode", e.full_name AS "employeeName",
           u.email AS "verifiedByName"
      FROM employee_documents d
      JOIN employees e ON e.id = d.employee_id
      LEFT JOIN users u ON u.id = d.verified_by
     WHERE (${filter.status ?? null}::text IS NULL OR d.verification_status = ${filter.status ?? null})
       AND (${filter.employeeId ?? null}::uuid IS NULL OR d.employee_id = ${filter.employeeId ?? null}::uuid)
     ORDER BY d.created_at DESC
  `)) as unknown as { rows: HrDocumentRow[] };
  return res.rows ?? [];
}
