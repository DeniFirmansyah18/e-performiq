import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, failFromError } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getVisionAchievement } from '@/lib/services/boardVisionAchievementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const periodCode = req.nextUrl.searchParams.get('periodCode') || undefined;
    const data = await getVisionAchievement(db, periodCode);
    return ok(data);
  } catch (err: any) {
      return failFromError(err, 'Gagal memuat capaian visi-misi');
    }
}
