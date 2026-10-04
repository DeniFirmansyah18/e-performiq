import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, problem } from '@/lib/api/response';
import { searchInstitutions, searchMajors } from '@/lib/services/educationReferenceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/reference?type=institutions|majors&q=...
// (PUBLIK) — pencarian sekolah/kampus (Indonesia) & jurusan untuk autocomplete form.
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') ?? 'institutions';
    const q = req.nextUrl.searchParams.get('q') ?? '';
    if (type === 'majors') {
      const majors = await searchMajors(db, q);
      return ok({ majors });
    }
    const institutions = await searchInstitutions(db, q);
    return ok({ institutions });
  } catch (err) {
    return problem(err, '/api/v1/careers/reference');
  }
}
