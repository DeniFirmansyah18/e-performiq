import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { getHrDashboard, getManagerDashboard } from '@/lib/services/dashboardAggregationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/dashboard/hr — agregasi lintas-modul untuk HR/BOD.
// Query `?manager=1` → ringkasan manager untuk karyawan pada sesi.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const manager = req.nextUrl.searchParams.get('manager') === '1';

    if (manager) {
      assertCan(session, 'kpi:read');
      if (!session.employeeId) return ok(null);
      const data = await getManagerDashboard(db, session.employeeId);
      return ok(data);
    }

    assertCan(session, 'analytics:read');
    const data = await getHrDashboard(db);
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/dashboard/hr');
  }
}
