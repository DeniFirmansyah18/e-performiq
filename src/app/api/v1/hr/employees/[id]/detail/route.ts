import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem } from '@/lib/api/response';
import { getDetailPegawai } from '@/lib/services/employeeDetailService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/hr/employees/:id/detail
 * Data lengkap seorang pegawai. Bagian penggajian hanya disertakan bila sesi
 * memegang izin `payroll:read` — penyaringan dilakukan di server, bukan klien.
 */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);

    const data = await getDetailPegawai(db, session, ctx.params.id);
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/hr/employees/[id]/detail');
  }
}
