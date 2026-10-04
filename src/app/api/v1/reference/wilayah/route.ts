import { NextRequest } from 'next/server';
import { ok, problem } from '@/lib/api/response';
import {
  listProvinces, listKabupaten, listKecamatan, listDesa, isAddressApiConfigured,
} from '@/lib/services/addressReferenceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/reference/wilayah?level=provinsi|kabupaten|kecamatan|desa&parent=<kode>  (PUBLIK)
// Dropdown bertingkat alamat Indonesia. Data dasar (prov/kab/kec) tersedia offline
// dari seed lokal; desa & kode pos diperkaya dari Wilayah Alamat API bila aktif.
export async function GET(req: NextRequest) {
  try {
    const level = (req.nextUrl.searchParams.get('level') ?? 'provinsi').toLowerCase();
    const parent = req.nextUrl.searchParams.get('parent') ?? '';
    let items: Awaited<ReturnType<typeof listProvinces>> = [];
    if (level === 'provinsi') items = await listProvinces();
    else if (level === 'kabupaten') items = await listKabupaten(parent);
    else if (level === 'kecamatan') items = await listKecamatan(parent);
    else if (level === 'desa') items = await listDesa(parent);
    else return ok({ items: [], apiConfigured: isAddressApiConfigured() });
    return ok({ items, apiConfigured: isAddressApiConfigured(), configured: true });
  } catch (err) {
    return problem(err, '/api/v1/reference/wilayah');
  }
}
