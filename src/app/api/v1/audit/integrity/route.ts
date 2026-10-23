import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { verifyAuditChain } from '@/lib/repositories/auditRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/audit/integrity — verifikasi rantai hash audit_logs
 * (PRD v2.0 §5.4: cap waktu anti-tamper). Hanya auditor & super admin.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'audit:read');

    const result = await verifyAuditChain(db);
    const message = result.ok
      ? `Rantai audit utuh (${result.checked} entri ber-hash diverifikasi).`
      : `Rantai audit rusak pada entri #${result.firstBrokenId}.`;

    return ok(result, message);
  } catch (err) {
    return problem(err, '/api/v1/audit/integrity');
  }
}
