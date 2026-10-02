import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { getCandidateSession } from '@/lib/auth/candidateSession';
import { resolveCandidateContext } from '@/lib/services/candidateContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/assessments/:attemptId — detail attempt milik kandidat
export async function GET(req: NextRequest, ctx: { params: { attemptId: string } }) {
  try {
    const session = await getCandidateSession(req);
    const candCtx = await resolveCandidateContext(db, session);
    if (!candCtx) return fail('NOT_FOUND', 'Tidak ada lamaran tertaut pada akun ini.', 404);

    const res = (await db.execute(sql`
      SELECT a.id AS "attemptId", a.status, a.score::float8 AS score, a.raw_score::float8 AS "rawScore",
             a.started_at AS "startedAt", a.submitted_at AS "submittedAt",
             t.code, t.title, t.type::text AS type, t.weight::float8 AS weight
        FROM assessment_attempts a
        JOIN assessment_templates t ON t.id = a.template_id
       WHERE a.id = ${ctx.params.attemptId}::uuid AND a.application_id = ${candCtx.applicationId}::uuid
    `)) as unknown as { rows: any[] };
    const attempt = res.rows?.[0];
    if (!attempt) return fail('NOT_FOUND', 'Asesmen tidak ditemukan.', 404);
    return ok(attempt);
  } catch (err) {
    return problem(err, '/api/v1/careers/assessments/[attemptId]');
  }
}
