import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, failFromError } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { code: string } };

/**
 * GET /api/v1/post-employment/service-letters/verify/[code]
 *
 * Publik tanpa autentikasi: pihak ketiga (perusahaan tujuan, bank) hanya perlu
 * kode verifikasi yang tercetak di surat untuk memastikan surat itu asli.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const result = await svc.verifyServiceLetter(db, ctx.params.code);
    return ok(result);
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/service-letters/verify');
  }
}
