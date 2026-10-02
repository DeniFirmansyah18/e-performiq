import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { getTimelineByApplicationNo } from '@/lib/services/timelineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/timeline/:applicationNo  (PUBLIK - tanpa login)
// Mengembalikan progres tahap lamaran lengkap untuk ditampilkan sebagai stepper.
export async function GET(_req: NextRequest, ctx: { params: { applicationNo: string } }) {
  try {
    const timeline = await getTimelineByApplicationNo(db, ctx.params.applicationNo);
    if (!timeline) return fail('NOT_FOUND', 'Nomor lamaran tidak ditemukan.', 404);
    return ok(timeline);
  } catch (err) {
    return problem(err, '/api/v1/careers/timeline/[applicationNo]');
  }
}
