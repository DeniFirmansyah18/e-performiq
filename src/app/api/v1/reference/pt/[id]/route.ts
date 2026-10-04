import { NextRequest } from 'next/server';
import { ok, problem } from '@/lib/api/response';
import { getPtDetail } from '@/lib/services/educationReferenceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/reference/pt/{id}?withProdi=1&tahun=20241   (PUBLIK)
// Detail perguruan tinggi (+ daftar prodi) via scraper PDDikti (best-effort).
// {id} adalah ID base64url dari hasil pencarian institusi.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const withProdi = req.nextUrl.searchParams.get('withProdi') === '1';
    const tahun = req.nextUrl.searchParams.get('tahun') ?? undefined;
    const result = await getPtDetail(params.id, { withProdi, tahun });
    return ok(result);
  } catch (err) {
    return problem(err, `/api/v1/reference/pt/${params.id}`);
  }
}
