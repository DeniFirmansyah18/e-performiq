import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError } from '@/lib/api/response';
import { muatKonteksPerusahaan, usulkanKpiDariVisiMisi } from '@/lib/services/kpiGeneratorAiService';
import { ForbiddenError } from '@/lib/auth/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERAN_IZIN = ['BOD', 'SUPER_ADMIN'];

// POST /api/v1/performance/kpi-cascade/corporate/generate
// Menyusun usulan KPI korporat dari visi & misi via AI (atau fallback).
// Tidak langsung menyimpan — BOD meninjau lalu membuat via POST corporate.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!PERAN_IZIN.includes(session.role)) {
      throw new ForbiddenError('Hanya BOD yang dapat menyusun KPI korporat dari visi & misi.');
    }

    const ctx = await muatKonteksPerusahaan(db, 'a0000000-0000-4000-8000-000000000001');
    const hasil = await usulkanKpiDariVisiMisi(ctx);
    return ok(hasil);
  } catch (err) {
    return failFromError(err, 'Gagal menyusun usulan KPI dari visi & misi.');
  }
}
