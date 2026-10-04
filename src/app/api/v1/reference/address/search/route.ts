import { NextRequest } from 'next/server';
import { ok, problem } from '@/lib/api/response';
import { searchAddress, isAddressApiConfigured } from '@/lib/services/addressReferenceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/reference/address/search?q=tebet&level=desa&limit=20  (PUBLIK)
// Cari alamat (nama / kode pos) di semua level; hasil dilengkapi alamat lengkap.
// Bila API tak aktif → pencarian dari seed lokal (prov/kab/kec).
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const level = req.nextUrl.searchParams.get('level') ?? undefined;
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '20');
    const results = await searchAddress(q, { level: level || undefined, limit });
    return ok({ results, apiConfigured: isAddressApiConfigured(), configured: true });
  } catch (err) {
    return problem(err, '/api/v1/reference/address/search');
  }
}
