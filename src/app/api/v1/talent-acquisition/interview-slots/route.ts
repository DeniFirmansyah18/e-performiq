import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { AuthError, BusinessRuleError } from '@/lib/auth/errors';
import { ok, problem, parseBody } from '@/lib/api/response';
import {
  listInterviewSlots,
  bookInterviewSlot,
} from '@/lib/services/talentAcquisitionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BookSchema = z.object({
  slotId: z.string().uuid(),
});

/** GET ?job_posting_id= — daftar slot wawancara sebuah lowongan. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req).catch(() => null);
    if (!session) return problem(new AuthError(), 'interview-slots');

    assertCan(session, 'kpi:read');

    const jobPostingId = new URL(req.url).searchParams.get('job_posting_id');
    if (!jobPostingId) {
      throw new BusinessRuleError('Parameter job_posting_id wajib diisi.');
    }

    const items = await listInterviewSlots(db, jobPostingId);
    return ok({ items, total: items.length }, 'Slot wawancara berhasil dimuat.');
  } catch (err) {
    return problem(err, 'interview-slots');
  }
}

/** POST — memesan satu slot wawancara. */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req).catch(() => null);
    if (!session) return problem(new AuthError(), 'interview-slots');

    assertCan(session, 'kpi:write');

    const body = await parseBody(req, BookSchema);
    const slot = await bookInterviewSlot(db, body.slotId);
    return ok(slot, 'Slot wawancara berhasil dipesan.');
  } catch (err) {
    return problem(err, 'interview-slots');
  }
}
