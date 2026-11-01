import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AddSchema = z.object({
  employee_id: z.string().uuid('employee_id harus berupa UUID'),
});

/** GET /api/v1/post-employment/alumni — direktori alumni & ringkasan. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:read');

    const overview = await svc.getAlumniOverview(db);
    return ok(overview);
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/alumni');
  }
}

/** POST /api/v1/post-employment/alumni — daftarkan karyawan keluar sebagai alumni. */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:alumni');
    const body = await parseBody(req, AddSchema);

    const out = await svc.addAlumni(db, body.employee_id);
    return ok(
      {
        message: `${out.employeeName} berhasil didaftarkan ke direktori alumni.`,
        data: out,
      },
      { status: 201 }
    );
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/alumni');
  }
}
