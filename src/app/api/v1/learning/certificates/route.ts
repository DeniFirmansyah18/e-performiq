import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { getCertificatesForEmployee } from '@/lib/services/certificateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/certificates
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    if (!session.employeeId) return ok({ certificates: [] });
    const certificates = await getCertificatesForEmployee(db, session.employeeId);
    return ok({ certificates });
  } catch (err) {
    return problem(err, '/api/v1/learning/certificates');
  }
}
