import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { approveQuestion } from '@/lib/services/technicalTestGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/recruitment/assessments/questions/[id]/approve  (HR)
// Menyetujui soal DRAFT → aktif (is_active = TRUE) sehingga dipakai kandidat.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const id = ctx?.params?.id;
    if (!id) return fail('BAD_REQUEST', 'id soal wajib diisi.', 400);

    await approveQuestion(db, id, { approvedBy: session.userId });
    return ok({ id, approved: true }, 'Soal disetujui dan aktif.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/assessments/questions/[id]/approve');
  }
}
