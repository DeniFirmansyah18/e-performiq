import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { submitQuiz } from '@/lib/services/courseContentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuizSchema = z.object({ answers: z.array(z.number().int()) });

// POST /api/v1/learning/modules/:id/quiz
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);
    const body = await req.json().catch(() => ({}));
    const parsed = QuizSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Jawaban tidak valid.', 400);
    const result = await submitQuiz(db, session.employeeId, ctx.params.id, parsed.data.answers);
    return ok(result, result.passed ? 'Kuis lulus.' : 'Kuis belum lulus.');
  } catch (err) {
    return problem(err, '/api/v1/learning/modules/[id]/quiz');
  }
}
