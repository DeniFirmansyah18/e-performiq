import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { getCandidateSession } from '@/lib/auth/candidateSession';
import { resolveCandidateContext } from '@/lib/services/candidateContext';
import { listAttemptsForApplication, listTemplates } from '@/lib/services/assessmentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/assessments — daftar asesmen (attempt) milik kandidat + template tersedia
export async function GET(req: NextRequest) {
  try {
    const session = await getCandidateSession(req);
    const ctx = await resolveCandidateContext(db, session);
    if (!ctx) return fail('NOT_FOUND', 'Tidak ada lamaran tertaut pada akun ini.', 404);

    const [attempts, templates] = await Promise.all([
      listAttemptsForApplication(db, ctx.applicationId),
      listTemplates(db),
    ]);
    return ok({
      applicationNo: ctx.applicationNo,
      postingTitle: ctx.postingTitle,
      attempts,
      templates: templates.map((t) => ({ id: t.id, code: t.code, title: t.title, type: t.type, weight: t.weight })),
    });
  } catch (err) {
    return problem(err, '/api/v1/careers/assessments');
  }
}
