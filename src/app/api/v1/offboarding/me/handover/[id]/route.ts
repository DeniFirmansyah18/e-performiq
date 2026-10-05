import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { markMyHandover } from '@/lib/services/offboardingSelfService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params { params: { id: string } }

// PATCH /api/v1/offboarding/me/handover/:id — karyawan menandai item serah terima miliknya.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'offboarding:write');
    const updated = await markMyHandover(db, session, params.id);
    return ok(updated, 'Item serah terima ditandai siap.');
  } catch (err) {
    return problem(err, `/api/v1/offboarding/me/handover/${params.id}`);
  }
}
