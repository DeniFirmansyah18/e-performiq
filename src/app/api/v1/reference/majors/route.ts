import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, problem } from '@/lib/api/response';
import { searchMajors } from '@/lib/services/educationReferenceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/reference/majors?q=<kata kunci>  (PUBLIK)
// Pencarian jurusan / program studi.
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const majors = await searchMajors(db, q);
    return ok({ majors });
  } catch (err) {
    return problem(err, '/api/v1/reference/majors');
  }
}
