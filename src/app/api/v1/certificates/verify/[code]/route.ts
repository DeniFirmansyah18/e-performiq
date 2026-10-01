import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { verifyCertificate } from '@/lib/services/certificateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/certificates/verify/:code  (PUBLIK)
export async function GET(_req: NextRequest, ctx: { params: { code: string } }) {
  try {
    const result = await verifyCertificate(db, ctx.params.code);
    if (!result.valid) return fail('NOT_FOUND', 'Sertifikat tidak ditemukan.', 404);
    return ok(result.certificate);
  } catch (err) {
    return problem(err, '/api/v1/certificates/verify/[code]');
  }
}
