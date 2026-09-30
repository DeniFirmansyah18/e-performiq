import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { AuthError, ForbiddenError } from '@/lib/auth/errors';
import { ok, problem, parseBody } from '@/lib/api/response';
import {
  applyToPosting,
  approveApplication,
  rejectApplication,
  listApplicationsForReview,
} from '@/lib/services/talentAcquisitionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ApplySchema = z.object({
  jobPostingId: z.string().uuid(),
  coverLetter: z.string().min(10, 'Cover letter minimal 10 karakter.'),
  cvUrl: z.string().url('cvUrl harus berupa URL yang valid.'),
});

const ReviewSchema = z.object({
  applicationId: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT']),
});

/** GET — daftar lamaran menunggu peninjauan (manajer). */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req).catch(() => null);
    if (!session) return problem(new AuthError(), 'applications');

    assertCan(session, 'kpi:approve');

    const items = await listApplicationsForReview(db);
    return ok({ items, total: items.length }, 'Daftar lamaran berhasil dimuat.');
  } catch (err) {
    return problem(err, 'applications');
  }
}

/** POST — karyawan melamar lowongan internal. */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req).catch(() => null);
    if (!session) return problem(new AuthError(), 'applications');

    assertCan(session, 'kpi:write');
    if (!session.employeeId) {
      throw new ForbiddenError('Akun pengguna ini tidak memiliki ID karyawan aktif.');
    }

    const body = await parseBody(req, ApplySchema);
    const result = await applyToPosting(
      db,
      session.employeeId,
      body.jobPostingId,
      body.coverLetter,
      body.cvUrl
    );
    return ok(
      result,
      `Lamaran terkirim. Skor screening CV: ${result.screeningScore}.`
    );
  } catch (err) {
    return problem(err, 'applications');
  }
}

/** PATCH — manajer menyetujui / menolak lamaran. */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req).catch(() => null);
    if (!session) return problem(new AuthError(), 'applications');

    assertCan(session, 'kpi:approve');

    const body = await parseBody(req, ReviewSchema);
    const result =
      body.action === 'APPROVE'
        ? await approveApplication(db, body.applicationId, session.userId)
        : await rejectApplication(db, body.applicationId, session.userId);
    return ok(
      result,
      body.action === 'APPROVE' ? 'Lamaran disetujui.' : 'Lamaran ditolak.'
    );
  } catch (err) {
    return problem(err, 'applications');
  }
}
