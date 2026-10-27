import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, failFromError } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getBoardCostOverview } from '@/lib/services/boardCostService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    // Data gaji bersifat RESTRICTED: hanya peran dengan payroll:read.
    assertCan(session, 'payroll:read');

    const sp = req.nextUrl.searchParams;
    const runId = sp.get('runId') || undefined;
    const page = Number(sp.get('page') ?? '1');
    const pageSize = Number(sp.get('pageSize') ?? '50');

    if (runId && !UUID_RE.test(runId)) {
      return fail('VALIDATION_ERROR', 'runId harus berupa UUID.', 400);
    }
    if (!Number.isInteger(page) || page < 1) {
      return fail('VALIDATION_ERROR', 'page harus bilangan bulat >= 1.', 400);
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      return fail('VALIDATION_ERROR', 'pageSize harus 1-200.', 400);
    }

    const data = await getBoardCostOverview(db, { runId, page, pageSize });
    return ok(data);
  } catch (err: any) {
      return failFromError(err, 'Gagal memuat ringkasan biaya');
    }
}
