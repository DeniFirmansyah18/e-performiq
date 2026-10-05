import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { fail, problem, ok } from '@/lib/api/response';
import { getCandidateSession } from '@/lib/auth/candidateSession';
import { resolveCandidateContext } from '@/lib/services/candidateContext';
import { getTimelineByApplicationNo } from '@/lib/services/timelineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/interview — detail jadwal wawancara lamaran kandidat (dari timeline).
export async function GET(req: NextRequest) {
  try {
    const session = await getCandidateSession(req);
    const ctx = await resolveCandidateContext(db, session);
    if (!ctx) return fail('NOT_FOUND', 'Tidak ada lamaran tertaut pada akun ini.', 404);

    const timeline = await getTimelineByApplicationNo(db, ctx.applicationNo);
    const interview = timeline?.entries.find((e) => e.stage === 'INTERVIEW') ?? null;

    return ok({
      applicationNo: ctx.applicationNo,
      postingTitle: ctx.postingTitle,
      status: ctx.status,
      interview: interview
        ? {
            stageStatus: interview.status,
            scheduledAt: interview.scheduledAt ?? null,
            meetingUrl: interview.meetingUrl ?? null,
            interviewerName: interview.interviewerName ?? null,
          }
        : null,
    });
  } catch (err) {
    return problem(err, '/api/v1/careers/interview');
  }
}
