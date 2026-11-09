import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem } from '@/lib/api/response';
import { getTargetAchievement } from '@/lib/services/targetAchievementService';
import { ForbiddenError } from '@/lib/auth/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/performance/target-achievement
 *
 * Mengembalikan indikator persentase capaian target (%) yang adaptif terhadap
 * hak akses pemanggil (Role-Based Access Control / Scoped):
 * - EMPLOYEE: KPI pribadi
 * - PEOPLE_MANAGER: Rerata & daftar anggota tim (+ capaian diri)
 * - HR_MANAGER / AUDITOR / SUPER_ADMIN: Agregat organisasi & breakdown departemen
 * - BOD: Agregat korporat & breakdown 4 Perspektif Balanced Scorecard (BSC)
 *
 * Query params opsional:
 * - `period_id`: ID periode penilaian (default: periode aktif/terbaru)
 * - `department_id`: filter departemen (hanya untuk peran dengan akses organisasi)
 * - `employee_id`: filter karyawan (harus berada dalam scope hak akses pemanggil)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('period_id') ?? undefined;
    const departmentId = searchParams.get('department_id') ?? undefined;
    const employeeId = searchParams.get('employee_id') ?? undefined;

    const data = await getTargetAchievement(db, session, {
      periodId,
      departmentId,
      employeeId,
    });

    return ok(data, 'Indikator pencapaian target berhasil dimuat.');
  } catch (err: any) {
    if (err instanceof ForbiddenError || err?.status === 403) {
      return fail('FORBIDDEN', err.message || 'Anda tidak memiliki hak akses untuk data ini.', 403);
    }
    return problem(err, '/api/v1/performance/target-achievement');
  }
}

