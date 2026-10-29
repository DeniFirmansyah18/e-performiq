import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { listExpiringOffers } from '@/lib/services/offerService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/recruitment/offers/expiring  (HR melihat penawaran mendekati jatuh tempo)
export async function GET(_req: NextRequest) {
  try {
    const session = await getAuthSession(_req);
    assertCan(session, 'recruitment:manage');
    const offers = await listExpiringOffers(db);
    return ok({ offers }, 'Daftar penawaran yang membutuhkan tindak lanjut.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/offers/expiring');
  }
}