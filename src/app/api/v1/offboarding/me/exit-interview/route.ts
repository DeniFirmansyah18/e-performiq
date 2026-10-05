import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem, parseBody } from '@/lib/api/response';
import { saveMyExitInterview } from '@/lib/services/offboardingSelfService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ExitSchema = z.object({
  feedback: z.string().min(1).max(4000),
  overallRating: z.number().int().min(1).max(5).optional(),
  wouldRecommend: z.boolean().optional(),
});

// POST /api/v1/offboarding/me/exit-interview — simpan exit interview karyawan.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'offboarding:write');
    const body = await parseBody(req, ExitSchema);
    const saved = await saveMyExitInterview(db, session, body);
    return ok(saved, 'Exit interview tersimpan.');
  } catch (err) {
    return problem(err, '/api/v1/offboarding/me/exit-interview');
  }
}
