import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
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

export interface AuditIntegrity {
  ok: boolean;
  checked: number;
  legacy: number;
  firstBrokenId: string | null;
}

const GENESIS = 'GENESIS';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Hash kanonik satu baris audit. Field yang di-hash sengaja hanya skalar yang
 * tidak dinormalisasi ulang oleh Postgres (JSONB mengubah urutan kunci, jadi
 * old_data/new_data tidak ikut); integritasnya sudah dijaga trigger immutability.
 */
export function computeAuditHash(input: {
  prevHash: string | null;
  id: string | number;
  userId?: string | null;
  actionType: string;
  entityName: string;
  recordId: string;
  description?: string | null;
  createdAtIso: string;
}): string {
  const payload = [
    input.prevHash ?? GENESIS,
    String(input.id),
    input.userId ?? '',
    input.actionType,
    input.entityName,
    input.recordId,
    input.description ?? '',
    input.createdAtIso,
  ].join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** Drizzle mengembalikan `{rows}` untuk PGlite dan array untuk postgres-js. */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

export async function insertAuditLog(db: Db, input: AuditRecordInput) {
  const isUuid = input.userId && UUID_RE.test(input.userId);
  const userId = isUuid ? input.userId : null;
  const createdAt = new Date().toISOString();

  return db.transaction(async (tx) => {
    // Serialisasi penulis rantai: tanpa ini dua insert bersamaan membaca
    // prev_hash yang sama dan verifikasi akan melaporkan alarm palsu.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(918273645)`);

    const idRows = rowsOf<{ id: string }>(
      await tx.execute(sql`SELECT nextval(pg_get_serial_sequence('audit_logs', 'id'))::text AS id`),
    );
    const id = idRows[0]?.id;
    if (!id) throw new Error('Gagal memperoleh id audit_logs berikutnya.');

    const prevRows = rowsOf<{ entryHash: string | null }>(
      await tx.execute(sql`
        SELECT entry_hash AS "entryHash" FROM audit_logs
         WHERE entry_hash IS NOT NULL
         ORDER BY id DESC LIMIT 1
      `),
    );
    const prevHash = prevRows[0]?.entryHash ?? null;

    const entryHash = computeAuditHash({
      prevHash,
      id,
      userId,
      actionType: input.actionType,
      entityName: input.entityName,
      recordId: input.recordId,
      description: input.description ?? null,
      createdAtIso: createdAt,
    });

    const inserted = rowsOf<{ id: string; created_at: string; prev_hash: string | null; entry_hash: string }>(
      await tx.execute(sql`
        INSERT INTO audit_logs (
          id, user_id, action_type, entity_name, record_id, old_data, new_data,
          description, ip_address, user_agent, created_at, prev_hash, entry_hash
        ) VALUES (
          ${id}::bigint,
          ${userId ? sql`${userId}::uuid` : sql`NULL`},
          ${input.actionType},
          ${input.entityName},
          ${input.recordId},
          ${input.oldData ? JSON.stringify(input.oldData) : sql`NULL`}::jsonb,
          ${input.newData ? JSON.stringify(input.newData) : sql`NULL`}::jsonb,
          ${input.description ?? null},
          ${input.ipAddress ?? null},
          ${input.userAgent ?? null},
          ${createdAt}::timestamptz,
          ${prevHash},
          ${entryHash}
        )
        RETURNING id::text AS id, created_at, prev_hash, entry_hash
      `),
    );

    return inserted[0];
  });
}

export async function selectAuditLogs(db: Db, limit = 50) {
  const result = await db.execute(sql`
    SELECT a.id, a.user_id, a.action_type, a.entity_name, a.record_id,
           a.old_data, a.new_data, a.description, a.ip_address, a.user_agent, a.created_at,
           a.prev_hash, a.entry_hash,
           u.email as user_email, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT ${limit}
  `);
  return result.rows;
}

/**
 * Menelusuri rantai hash dari baris ber-hash paling awal. Baris warisan
 * (`entry_hash IS NULL`) dilewati dan dilaporkan terpisah, sehingga database
 * lama tidak langsung dinyatakan rusak.
 */
export async function verifyAuditChain(db: Db): Promise<AuditIntegrity> {
  const chained = (await db.execute(sql`
    SELECT id::text AS id, user_id::text AS "userId", action_type AS "actionType",
           entity_name AS "entityName", record_id AS "recordId",
           description, created_at, prev_hash AS "prevHash", entry_hash AS "entryHash"
      FROM audit_logs
     WHERE entry_hash IS NOT NULL
     ORDER BY id
  `)) as unknown as {
    rows: Array<{
      id: string; userId: string | null; actionType: string; entityName: string;
      recordId: string; description: string | null; created_at: string;
      prevHash: string | null; entryHash: string;
    }>;
  };

  const legacyRes = (await db.execute(sql`
    SELECT count(*)::int AS n FROM audit_logs WHERE entry_hash IS NULL
  `)) as unknown as { rows: Array<{ n: number }> };

  const rows = chained.rows ?? [];
  let previous: string | null = null;
  let firstBrokenId: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const createdAtIso = new Date(row.created_at).toISOString();
    const expected = computeAuditHash({
      prevHash: previous,
      id: row.id,
      userId: row.userId,
      actionType: row.actionType,
      entityName: row.entityName,
      recordId: row.recordId,
      description: row.description,
      createdAtIso,
    });

    if (row.prevHash !== previous || row.entryHash !== expected) {
      firstBrokenId = row.id;
      break;
    }
    previous = row.entryHash;
  }

  return {
    ok: firstBrokenId === null,
    checked: rows.length,
    legacy: Number(legacyRes.rows?.[0]?.n ?? 0),
    firstBrokenId,
  };
}
