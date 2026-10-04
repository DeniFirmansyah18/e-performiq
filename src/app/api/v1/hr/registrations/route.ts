import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { listPendingRegistrations } from '@/lib/services/employeeRegistrationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/hr/registrations — daftar registrasi karyawan menunggu (HR).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const items = await listPendingRegistrations(db);
    return ok({ items });
  } catch (err) {
    return problem(err, '/api/v1/hr/registrations');
  }
}
