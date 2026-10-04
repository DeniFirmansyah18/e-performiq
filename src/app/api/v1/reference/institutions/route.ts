import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, problem } from '@/lib/api/response';
import { searchInstitutions } from '@/lib/services/educationReferenceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/reference/institutions?q=<kata kunci>  (PUBLIK)
// Pencarian sekolah/kampus (lokal + API publik; best-effort).
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const institutions = await searchInstitutions(db, q);
    return ok({ institutions });
  } catch (err) {
    return problem(err, '/api/v1/reference/institutions');
  }
}
