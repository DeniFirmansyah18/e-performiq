import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { insertAuditLog, selectAuditLogs, AuditRecordInput } from '@/lib/repositories/auditRepository';

export async function logAction(db: Db, input: AuditRecordInput) {
  return insertAuditLog(db, input);
}

export async function getAuditLogs(db: Db, session: SessionPayload, limit = 50) {
  assertCan(session, 'audit:read');
  return selectAuditLogs(db, limit);
}
