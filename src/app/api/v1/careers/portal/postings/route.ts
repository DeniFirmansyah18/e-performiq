import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, problem } from '@/lib/api/response';
import { listCandidatePostings } from '@/lib/services/candidateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/portal/postings?search=&department=
// Lowongan untuk portal kandidat: kualifikasi + kuota (MPP − terisi) + status real-time.
// Publik (boleh diakses sebelum login) agar halaman karier menampilkan kuota/status.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const department = searchParams.get('department') || undefined;
    const postings = await listCandidatePostings(db, { search, department });
    return ok({ postings });
  } catch (err) {
    return problem(err, '/api/v1/careers/portal/postings');
  }
}
