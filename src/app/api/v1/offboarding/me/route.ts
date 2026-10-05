import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem, parseBody } from '@/lib/api/response';
import { getMyOffboarding, initiateMyOffboarding } from '@/lib/services/offboardingSelfService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const InitiateSchema = z.object({
  reasonForLeaving: z.string().min(1).max(100),
  resignationNoticeDate: z.string().min(1),
  lastWorkingDay: z.string().min(1),
});

// GET /api/v1/offboarding/me — ringkasan offboarding karyawan sendiri (fase Setelah Kerja).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'offboarding:read');
    const data = await getMyOffboarding(db, session.employeeId);
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/offboarding/me');
  }
}

// POST /api/v1/offboarding/me — karyawan mengajukan resign sendiri.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'offboarding:write');
    const body = await parseBody(req, InitiateSchema);
    const created = await initiateMyOffboarding(db, session, body);
    return ok(created, 'Pengajuan resign berhasil dikirim.');
  } catch (err) {
    return problem(err, '/api/v1/offboarding/me');
  }
}
