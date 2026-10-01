import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { getApplicationStatus } from '@/lib/services/candidateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/status/:applicationNo  (PUBLIK)
export async function GET(_req: NextRequest, ctx: { params: { applicationNo: string } }) {
  try {
    const status = await getApplicationStatus(db, ctx.params.applicationNo);
    if (!status) return fail('NOT_FOUND', 'Nomor lamaran tidak ditemukan.', 404);
    return ok(status);
  } catch (err) {
    return problem(err, '/api/v1/careers/status/[applicationNo]');
  }
}
