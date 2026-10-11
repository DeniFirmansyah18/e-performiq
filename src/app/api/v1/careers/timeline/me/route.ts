import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getCandidateSessionOrNull } from '@/lib/auth/candidateSession';
import { resolveCandidateContext } from '@/lib/services/candidateContext';
import { getTimelineByApplicationNo } from '@/lib/services/timelineService';
import { ok, fail, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/timeline/me — progres tahap lamaran kandidat yang sedang login.
// Berbasis sesi (bukan nomor lamaran manual), agar menu "Progress Tahapan" di portal
// langsung menampilkan stepper tanpa perlu mengetik nomor lamaran.
export async function GET(req: NextRequest) {
  try {
    const session = await getCandidateSessionOrNull(req);
    if (!session) return fail('UNAUTHORIZED', 'Silakan login sebagai kandidat.', 401);

    const ctx = await resolveCandidateContext(db, session);
    if (!ctx) return fail('NOT_FOUND', 'Belum ada lamaran pada akun ini.', 404);

    const timeline = await getTimelineByApplicationNo(db, ctx.applicationNo);
    if (!timeline) return fail('NOT_FOUND', 'Progres lamaran tidak ditemukan.', 404);
    return ok(timeline);
  } catch (err) {
    return problem(err, '/api/v1/careers/timeline/me');
  }
}
