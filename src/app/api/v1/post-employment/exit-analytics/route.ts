import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/post-employment/exit-analytics — atrisi, alasan keluar, dan biaya. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:analytics');

    const analytics = await svc.getExitAnalytics(db);
    return ok(analytics);
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/exit-analytics');
  }
}
