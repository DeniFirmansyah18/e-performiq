import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError } from '@/lib/api/response';
import { getCascadeIntegrity } from '@/lib/services/kpiCascadeService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/kpi-cascade/integrity
// Status rantai: apakah seluruh KPI tersambung sampai pilar strategis.
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const hasil = await getCascadeIntegrity(db);
    return ok(hasil);
  } catch (err) {
    return failFromError(err, 'Gagal menelaah integritas rantai KPI.');
  }
}
