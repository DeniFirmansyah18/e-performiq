import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { decideTimesheet } from '@/lib/services/attendanceLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DecideSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(500).optional(),
});

// POST /api/v1/attendance/timesheets/:id/decide — approve/reject (atasan)
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'attendance:approve');
    const body = await req.json().catch(() => ({}));
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Keputusan tidak valid.', 400);

    const row = await decideTimesheet(db, {
      timesheetId: ctx.params.id,
      approverUserId: session.userId,
      decision: parsed.data.decision,
      note: parsed.data.note,
    });
    if (!row) return fail('NOT_FOUND', 'Timesheet tidak ditemukan.', 404);
    return ok(row, parsed.data.decision === 'APPROVED' ? 'Timesheet disetujui.' : 'Timesheet ditolak.');
  } catch (err) {
    return problem(err, '/api/v1/attendance/timesheets/[id]/decide');
  }
}
