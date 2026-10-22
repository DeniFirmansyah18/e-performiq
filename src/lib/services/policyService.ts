import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { logAction } from './auditService';

export type PolicyType = 'SOP' | 'PP' | 'SK' | 'IK';
export type PolicyStatus = 'DRAFT' | 'AKTIF' | 'OBSOLETE';

export interface PolicyRow {
  id: string;
  documentCode: string;
  title: string;
  policyType: PolicyType;
  version: string;
  effectiveDate: string;
  fileUrl: string;
  status: PolicyStatus;
  acknowledgedAt: string | null;
  storageKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  scanStatus?: 'CLEAN' | 'INFECTED' | 'SKIPPED' | null;
}

/**
 * `fileUrl` selalu bisa dipakai UI: bila dokumen diunggah, arahkan ke endpoint
 * unduh aplikasi; bila dokumen lama menyimpan URL eksternal, pakai URL itu.
 */
const FILE_URL_EXPR = sql`
  COALESCE(p.file_url, '/api/v1/policies/' || p.id || '/file')
`;

/** Hanya versi AKTIF yang boleh dibaca karyawan sebagai kewajiban. */
export async function listPolicies(db: Db, employeeId: string): Promise<PolicyRow[]> {
  const res = (await db.execute(sql`
    SELECT p.id, p.document_code AS "documentCode", p.title,
           p.policy_type AS "policyType", p.version,
           p.effective_date AS "effectiveDate", ${FILE_URL_EXPR} AS "fileUrl", p.status,
           p.storage_key AS "storageKey", p.file_name AS "fileName",
           p.file_size AS "fileSize", p.scan_status AS "scanStatus",
           a.acknowledged_at AS "acknowledgedAt"
      FROM policy_documents p
      LEFT JOIN policy_acknowledgments a
        ON a.policy_document_id = p.id AND a.employee_id = ${employeeId}::uuid
     WHERE p.status = 'AKTIF'
     ORDER BY p.policy_type, p.title
  `)) as unknown as { rows: PolicyRow[] };
  return res.rows ?? [];
}

export async function getPolicy(db: Db, id: string): Promise<PolicyRow | null> {
  const res = (await db.execute(sql`
    SELECT p.id, p.document_code AS "documentCode", p.title, p.policy_type AS "policyType",
           p.version, p.effective_date AS "effectiveDate", ${FILE_URL_EXPR} AS "fileUrl", p.status,
           p.storage_key AS "storageKey", p.file_name AS "fileName",
           p.file_size AS "fileSize", p.scan_status AS "scanStatus",
           NULL::timestamptz AS "acknowledgedAt"
      FROM policy_documents p WHERE p.id = ${id}::uuid
  `)) as unknown as { rows: PolicyRow[] };
  return res.rows?.[0] ?? null;
}

export async function acknowledge(
  db: Db,
  input: { policyId: string; employeeId: string },
): Promise<{ acknowledgedAt: string }> {
  const doc = await getPolicy(db, input.policyId);
  if (!doc) throw new BusinessRuleError('Dokumen tidak ditemukan.');
  if (doc.status !== 'AKTIF') {
    throw new BusinessRuleError('Hanya dokumen berstatus AKTIF yang dapat diakui.');
  }

  const res = (await db.execute(sql`
    INSERT INTO policy_acknowledgments (policy_document_id, employee_id)
    VALUES (${input.policyId}::uuid, ${input.employeeId}::uuid)
    ON CONFLICT (policy_document_id, employee_id) DO NOTHING
    RETURNING acknowledged_at AS "acknowledgedAt"
  `)) as unknown as { rows: Array<{ acknowledgedAt: string }> };

  if (res.rows?.[0]) return res.rows[0];

  const existing = (await db.execute(sql`
    SELECT acknowledged_at AS "acknowledgedAt" FROM policy_acknowledgments
     WHERE policy_document_id = ${input.policyId}::uuid
       AND employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: Array<{ acknowledgedAt: string }> };
  return existing.rows[0];
}

/** Menerbitkan versi baru; versi lama otomatis menjadi OBSOLETE. */
export async function publishVersion(
  db: Db,
  input: {
    documentCode: string;
    title: string;
    policyType: PolicyType;
    version: string;
    effectiveDate: string;
    fileUrl?: string;
    ownerDepartmentId?: string;
    supersedesId?: string;
    storageKey?: string;
    fileName?: string;
    fileSize?: number;
    checksumSha256?: string;
    scanStatus?: 'CLEAN' | 'INFECTED' | 'SKIPPED';
    scanEngine?: string;
    pageCount?: number | null;
    /** Pelaku, untuk jejak audit. Opsional agar pemanggil lama tetap jalan. */
    actorId?: string;
  },
): Promise<PolicyRow> {
  if (!input.fileUrl && !input.storageKey) {
    throw new BusinessRuleError('Sertakan berkas (unggahan) atau URL berkas.');
  }

  if (input.supersedesId) {
    await db.execute(sql`
      UPDATE policy_documents SET status = 'OBSOLETE' WHERE id = ${input.supersedesId}::uuid
    `);
  }

  const res = (await db.execute(sql`
    INSERT INTO policy_documents
      (document_code, title, policy_type, version, owner_department_id,
       effective_date, file_url, status, supersedes_id,
       storage_key, file_name, file_size, checksum_sha256, scan_status, scan_engine, page_count)
    VALUES (${input.documentCode}, ${input.title}, ${input.policyType}::policy_type_enum,
            ${input.version}, ${input.ownerDepartmentId ?? null}::uuid,
            ${input.effectiveDate}::date, ${input.fileUrl ?? null}, 'AKTIF',
            ${input.supersedesId ?? null}::uuid,
            ${input.storageKey ?? null}, ${input.fileName ?? null},
            ${input.fileSize ?? null}, ${input.checksumSha256 ?? null},
            ${input.scanStatus ?? 'SKIPPED'}, ${input.scanEngine ?? null},
            ${input.pageCount ?? null})
    RETURNING id, document_code AS "documentCode", title,
              policy_type AS "policyType", version,
              effective_date AS "effectiveDate",
              COALESCE(file_url, '/api/v1/policies/' || id || '/file') AS "fileUrl", status,
              storage_key AS "storageKey", file_name AS "fileName",
              file_size AS "fileSize", scan_status AS "scanStatus",
              NULL::timestamptz AS "acknowledgedAt"
  `)) as unknown as { rows: PolicyRow[] };

  const row = res.rows[0];
  await logAction(db, {
    userId: input.actorId ?? null,
    actionType: 'CREATE',
    entityName: 'policy_documents',
    recordId: row.id,
    newData: {
      documentCode: input.documentCode,
      version: input.version,
      policyType: input.policyType,
      status: 'AKTIF',
      storageKey: input.storageKey ?? null,
      scanStatus: input.scanStatus ?? 'SKIPPED',
    },
    description: `Menerbitkan ${input.policyType} ${input.documentCode} versi ${input.version}`,
  });

  return row;
}

export interface HrPolicyRow extends PolicyRow {
  acknowledgedCount: number;
  supersedesId: string | null;
}

/**
 * Daftar seluruh versi (DRAFT/AKTIF/OBSOLETE) untuk HR, beserta jumlah
 * karyawan yang sudah mengakui tiap versi.
 */
export async function listAllPolicies(db: Db): Promise<HrPolicyRow[]> {
  const res = (await db.execute(sql`
    SELECT p.id, p.document_code AS "documentCode", p.title,
           p.policy_type AS "policyType", p.version,
           p.effective_date AS "effectiveDate", ${FILE_URL_EXPR} AS "fileUrl", p.status,
           p.supersedes_id AS "supersedesId",
           p.storage_key AS "storageKey", p.file_name AS "fileName",
           p.file_size AS "fileSize", p.scan_status AS "scanStatus",
           (SELECT count(*)::int FROM policy_acknowledgments a
             WHERE a.policy_document_id = p.id) AS "acknowledgedCount"
      FROM policy_documents p
     ORDER BY p.document_code, p.effective_date DESC
  `)) as unknown as { rows: HrPolicyRow[] };
  return res.rows ?? [];
}

/**
 * Menerbitkan versi baru lewat `supersedesVersion` (kode + versi), bukan UUID —
 * panel HR tahu kode dan versi, bukan id baris lama.
 */
export async function publishByVersion(
  db: Db,
  input: {
    documentCode: string;
    title: string;
    policyType: PolicyType;
    version: string;
    effectiveDate: string;
    fileUrl?: string;
    ownerDepartmentId?: string;
    supersedesVersion?: string;
    storageKey?: string;
    fileName?: string;
    fileSize?: number;
    checksumSha256?: string;
    scanStatus?: 'CLEAN' | 'INFECTED' | 'SKIPPED';
    scanEngine?: string;
    pageCount?: number | null;
    actorId?: string;
  },
): Promise<PolicyRow> {
  let supersedesId: string | undefined;

  if (input.supersedesVersion) {
    const prev = (await db.execute(sql`
      SELECT id FROM policy_documents
       WHERE document_code = ${input.documentCode}
         AND version = ${input.supersedesVersion}
    `)) as unknown as { rows: Array<{ id: string }> };

    supersedesId = prev.rows?.[0]?.id;
    if (!supersedesId) {
      throw new BusinessRuleError(
        `Versi ${input.supersedesVersion} untuk ${input.documentCode} tidak ditemukan.`,
      );
    }
  }

  const duplicate = (await db.execute(sql`
    SELECT 1 FROM policy_documents
     WHERE document_code = ${input.documentCode} AND version = ${input.version}
  `)) as unknown as { rows: unknown[] };
  if (duplicate.rows?.length) {
    throw new BusinessRuleError(
      `Versi ${input.version} untuk ${input.documentCode} sudah ada. Gunakan nomor versi lain.`,
    );
  }

  return publishVersion(db, { ...input, supersedesId });
}

export async function compliance(
  db: Db,
): Promise<Array<{ departmentId: string; active: number; acknowledged: number; percent: number }>> {  const res = (await db.execute(sql`
    SELECT e.department_id AS "departmentId",
           count(DISTINCT e.id)::int AS active,
           count(DISTINCT a.employee_id)::int AS acknowledged
      FROM employees e
      LEFT JOIN policy_acknowledgments a ON a.employee_id = e.id
      LEFT JOIN policy_documents p
        ON p.id = a.policy_document_id AND p.status = 'AKTIF'
     WHERE e.status <> 'RESIGNED'
     GROUP BY e.department_id
  `)) as unknown as { rows: Array<{ departmentId: string; active: number; acknowledged: number }> };

  return (res.rows ?? []).map((r) => ({
    departmentId: r.departmentId,
    active: Number(r.active),
    acknowledged: Number(r.acknowledged),
    percent: Number(r.active) > 0 ? Math.round((Number(r.acknowledged) / Number(r.active)) * 100) : 0,
  }));
}
