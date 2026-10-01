import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, problem } from '@/lib/api/response';
import { listPublicPostings } from '@/lib/services/candidateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/postings  (PUBLIK - tanpa sesi)
export async function GET(_req: NextRequest) {
  try {
    const postings = await listPublicPostings(db);
    return ok({ postings });
  } catch (err) {
    return problem(err, '/api/v1/careers/postings');
  }
}
