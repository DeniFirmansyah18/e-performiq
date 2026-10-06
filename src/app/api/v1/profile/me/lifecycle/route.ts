import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { getMyLifecycleProfile } from '@/lib/services/employeeProfileService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/profile/me/lifecycle — identitas + status kepegawaian + progres fase
// (Sebelum Kerja / Saat Kerja / Setelah Kerja) untuk kartu identitas portal karyawan.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);
    const profile = await getMyLifecycleProfile(db, session.employeeId);
    if (!profile) return fail('NOT_FOUND', 'Data karyawan tidak ditemukan.', 404);
    return ok(profile);
  } catch (err) {
    return problem(err, '/api/v1/profile/me/lifecycle');
  }
}
