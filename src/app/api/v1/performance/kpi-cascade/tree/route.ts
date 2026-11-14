import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError } from '@/lib/api/response';
import { getCascadeTree } from '@/lib/services/kpiCascadeService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/kpi-cascade/tree
// Pohon KPI berjenjang lengkap: korporat → divisi → manajer → posisi.
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const tree = await getCascadeTree(db);
    return ok({ items: tree, total: tree.length });
  } catch (err) {
    return failFromError(err, 'Gagal memuat pohon KPI berjenjang.');
  }
}
