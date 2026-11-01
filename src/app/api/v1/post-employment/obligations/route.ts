import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GenerateSchema = z.object({
  employee_id: z.string().uuid('employee_id harus berupa UUID'),
  reference_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Tanggal acuan tidak valid')
    .optional(),
});

/** GET /api/v1/post-employment/obligations — kewajiban pasca-kerja seluruh karyawan. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:read');

    const overview = await svc.getObligationOverview(db);
    return ok(overview);
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/obligations');
  }
}

/** POST /api/v1/post-employment/obligations — buat paket kewajiban standar. */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:manage');
    const body = await parseBody(req, GenerateSchema);

    const out = await svc.generateObligations(db, body.employee_id, body.reference_date);
    return ok(
      {
        message:
          out.created > 0
            ? `${out.created} kewajiban pasca-kerja berhasil dibuat.`
            : 'Semua kewajiban pasca-kerja untuk karyawan ini sudah ada.',
        data: out,
      },
      { status: 201 }
    );
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/obligations');
  }
}
