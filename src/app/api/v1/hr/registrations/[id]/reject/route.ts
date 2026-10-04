import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem, parseBody } from '@/lib/api/response';
import { rejectRegistration } from '@/lib/services/employeeRegistrationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RejectSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// POST /api/v1/hr/registrations/:id/reject — tolak registrasi (HR).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const { reason } = await parseBody(req, RejectSchema);
    // Pra-validasi id agar UUID ngawur → 404 yang jelas, bukan 500.
    const exists = (await db.execute(
      sql`SELECT id FROM employee_registrations WHERE id = ${ctx.params.id}::uuid LIMIT 1`,
    )) as unknown as { rows: unknown[] };
    if ((exists.rows ?? []).length === 0) {
      return fail('NOT_FOUND', 'Registrasi tidak ditemukan.', 404);
    }
    const result = await rejectRegistration(db, ctx.params.id, {
      approvedBy: session.userId,
      reason,
    });
    return ok(result, 'Registrasi ditolak.');
  } catch (err) {
    return problem(err, '/api/v1/hr/registrations/[id]/reject');
  }
}
