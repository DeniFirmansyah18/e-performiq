import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface AuditRecordInput {
  userId?: string | null;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'CALIBRATE' | 'DISBURSE' | 'APPROVE' | 'LOGIN' | 'LOGOUT' | 'UNLOCK';
  entityName: string;
  recordId: string;
  oldData?: any;
  newData?: any;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}


const GENESIS = 'GENESIS';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


/** Drizzle mengembalikan `{rows}` untuk PGlite dan array untuk postgres-js. */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

export async function insertAuditLog(db: Db, input: AuditRecordInput) {
  // Pencatatan audit sederhana: hash chain dihapus bersama modul audit.
  // `userId` non-UUID diperlakukan sebagai NULL agar insert tidak gagal.
  const isUuid = input.userId && UUID_RE.test(input.userId);
  const userId = isUuid ? input.userId : null;

  const inserted = rowsOf<{ id: string; created_at: string }>(await db.execute(sql`
    INSERT INTO audit_logs (
      user_id, action_type, entity_name, record_id, old_data, new_data,
      description, ip_address, user_agent
    ) VALUES (
      ${userId ? sql`${userId}::uuid` : sql`NULL`},
      ${input.actionType},
      ${input.entityName},
      ${input.recordId},
      ${input.oldData ? JSON.stringify(input.oldData) : sql`NULL`}::jsonb,
      ${input.newData ? JSON.stringify(input.newData) : sql`NULL`}::jsonb,
      ${input.description ?? null},
      ${input.ipAddress ?? null},
      ${input.userAgent ?? null}
    )
    RETURNING id::text AS id, created_at
  `));

  return inserted[0];
}

export async function selectAuditLogs(db: Db, limit = 50) {
  const result = await db.execute(sql`
    SELECT a.id, a.user_id, a.action_type, a.entity_name, a.record_id,
           a.old_data, a.new_data, a.description, a.ip_address, a.user_agent, a.created_at,
           u.email as user_email, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT ${limit}
  `);
  return result.rows;
}

