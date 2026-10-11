import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as offboardingService from '@/lib/services/offboardingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DisburseSchema = z.object({
  severance_id: z.string().min(1, 'severance_id wajib diisi'),
});

// POST /api/v1/offboarding/disburse
// PRD §8 & §11.2: Mencairkan pesangon. Bila clearance 100% terverifikasi, lifecycle
// offboarding dituntaskan (status COMPLETED) dan karyawan dinonaktifkan.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, DisburseSchema);

    const result = await offboardingService.disburseSeverance(db, session, body.severance_id);

    return ok({
      ...result,
      message: result?.completion?.employeeDeactivated
        ? 'Pesangon dicairkan. Offboarding tuntas & karyawan dinonaktifkan.'
        : 'Pesangon berhasil dicairkan.',
      data: result,
    });
  } catch (err) {
    return problem(err, '/api/v1/offboarding/disburse');
  }
}
