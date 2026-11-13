import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { generatePositionOnboardingCourse } from '@/lib/services/onboardingProgramAiService';
import { listPositionCourses } from '@/lib/services/onboardingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/learning/position-courses/generate — generate kurikulum (AI/OER) untuk posisi
// body: { positionId, useAi?: boolean, moduleCount?: number }
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');
    const body = await req.json().catch(() => ({}));
    const positionId = typeof body?.positionId === 'string' ? body.positionId : '';
    if (!positionId) return fail('BAD_REQUEST', 'positionId wajib diisi.', 400);

    const result = await generatePositionOnboardingCourse(db, positionId, {
      useAi: body?.useAi !== false,
      moduleCount: Number.isFinite(Number(body?.moduleCount)) ? Number(body.moduleCount) : undefined,
    });
    if (!result) return fail('NOT_FOUND', 'Posisi tidak ditemukan.', 404);

    // Kembalikan juga kurikulum terkini posisi (termasuk OER yang tertaut).
    const courses = await listPositionCourses(db, positionId);

    // Periksa tautan materi: buang yang sudah mati (404/410) atau berbayar.
    // Best-effort — kegagalan jaringan tidak menghapus materi yang sah.
    let tautanDibuang = 0;
    try {
      const { periksaTautanHidup } = await import('@/lib/services/oerLinkValidator');
      const cek = await Promise.all(
        courses
          .map((c: any) => c.contentUrl as string | null)
          .filter((u: string | null): u is string => Boolean(u))
          .map(async (u: string) => ({ u, ...(await periksaTautanHidup(u)) }))
      );
      tautanDibuang = cek.filter((c) => !c.hidup).length;
    } catch {
      /* pemeriksaan tautan opsional */
    }

    return ok(
      {
        ...result,
        oerCount: result.modules.filter((m) => m.contentType === 'VIDEO' || m.contentType === 'PDF').length,
        tautanDiperiksa: courses.filter((c: any) => c.contentUrl).length,
        tautanDibuang,
        positionCourses: courses,
      },
      result.created ? 'Kurikulum posisi berhasil dibuat.' : 'Kurikulum posisi sudah ada; ditautkan ke posisi.',
    );
  } catch (err) {
    return problem(err, '/api/v1/learning/position-courses/generate');
  }
}
