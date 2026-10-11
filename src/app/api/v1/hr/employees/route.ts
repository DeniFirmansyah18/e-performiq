import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { listEmployeesForHr } from '@/lib/services/hrEmployeeDirectoryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/hr/employees — daftar karyawan untuk picker HR (mis. Generate Onboarding).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
    const employees = await listEmployeesForHr(db, { includeInactive });
    return ok({ employees, total: employees.length });
  } catch (err) {
    return problem(err, '/api/v1/hr/employees');
  }
}
