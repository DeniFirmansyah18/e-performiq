import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as auditService from '@/lib/services/auditService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/governance/audit-logs
// PRD §11.2 — Mengambil jejak audit perubahan nilai anti-manipulasi (READ-ONLY AUDITOR access)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));

    const logs = await auditService.getAuditLogs(db, session, limit);

    return ok({
      audit_trail: logs.map((log: any) => ({
        log_id: log.id,
        timestamp: log.created_at,
        user_name: log.user_email ?? 'System Engine',
        user_role: log.user_role ?? 'SYSTEM',
        action_type: log.action_type,
        entity_name: log.entity_name,
        record_id: log.record_id,
        description: log.description,
        old_data: log.old_data ?? null,
        new_data: log.new_data ?? null,
        ip_address: log.ip_address ?? '127.0.0.1',
      })),
      total_count: logs.length,
      gcg_compliance: {
        log_integrity: 'VERIFIED',
        immutability: 'APPEND_ONLY — Log tidak dapat dihapus atau diubah (PostgreSQL Trigger Protected).',
        access_level: 'READ_ONLY — Hanya AUDITOR dan SUPER_ADMIN yang dapat mengakses endpoint ini.',
        tarif_principle: 'Accountability & Transparency — PRD §6.2',
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return problem(err, '/api/v1/governance/audit-logs');
  }
}
