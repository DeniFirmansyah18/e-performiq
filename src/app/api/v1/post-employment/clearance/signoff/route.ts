import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SignoffSchema = z.object({
  employee_id: z.string().uuid('employee_id harus berupa UUID'),
  department: z.enum(['HR', 'IT', 'FINANCE', 'MANAGER', 'LEGAL']),
  is_cleared: z.boolean(),
  notes: z.string().max(1000).nullable().optional(),
});

/** POST /api/v1/post-employment/clearance/signoff — setujui/batalkan unit kerja. */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:manage');
    const body = await parseBody(req, SignoffSchema);

    const out = await svc.setClearanceSignoff(db, {
      employeeId: body.employee_id,
      department: body.department,
      isCleared: body.is_cleared,
      clearedBy: body.is_cleared ? session.userId : null,
      notes: body.notes ?? null,
    });

    return ok({
      message: body.is_cleared
        ? 'Unit kerja dinyatakan bersih dari tanggungan.'
        : 'Persetujuan unit kerja dibatalkan.',
      data: out,
    });
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/clearance/signoff');
  }
}
