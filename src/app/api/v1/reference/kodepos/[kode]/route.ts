import { NextRequest } from 'next/server';
import { ok, problem } from '@/lib/api/response';
import { lookupKodepos, isAddressConfigured } from '@/lib/services/addressReferenceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/reference/kodepos/{kode}   (PUBLIK)
// Cari desa/kelurahan pemilik kode pos (mis. 65161).
export async function GET(
  _req: NextRequest,
  { params }: { params: { kode: string } },
) {
  try {
    const items = await lookupKodepos(params.kode);
    return ok({ items, configured: isAddressConfigured() });
  } catch (err) {
    return problem(err, `/api/v1/reference/kodepos/${params.kode}`);
  }
}
