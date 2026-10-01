import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { getMyProfile, updateMyProfile } from '@/lib/services/employeeProfileService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/profile/me
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);
    const profile = await getMyProfile(db, session.employeeId);
    return ok(profile);
  } catch (err) {
    return problem(err, '/api/v1/profile/me');
  }
}

const ProfileSchema = z.object({
  phone_number: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  date_of_birth: z.string().max(30).optional(),
  emergency_contact_name: z.string().max(150).optional(),
  emergency_contact_phone: z.string().max(30).optional(),
  photo_url: z.string().max(500).optional(),
  bio: z.string().max(1000).optional(),
}).strict();

// PATCH /api/v1/profile/me
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'profile:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);
    const body = await req.json().catch(() => ({}));
    const parsed = ProfileSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data profil tidak valid.', 400);
    }
    const updated = await updateMyProfile(db, session.employeeId, parsed.data, session.userId);
    return ok(updated, 'Profil diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/profile/me');
  }
}
