import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { AuthError } from '@/lib/auth/errors';
import { ok, problem } from '@/lib/api/response';
import { listOpenPostings } from '@/lib/services/talentAcquisitionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/talent-acquisition/job-postings — bursa lowongan internal. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req).catch(() => null);
    if (!session) return problem(new AuthError(), 'job-postings');

    assertCan(session, 'kpi:read');

    const items = await listOpenPostings(db);
    return ok({ items, total: items.length }, 'Lowongan internal berhasil dimuat.');
  } catch (err) {
    return problem(err, 'job-postings');
  }
}
