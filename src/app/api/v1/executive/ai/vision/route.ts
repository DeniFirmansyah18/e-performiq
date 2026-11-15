import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { analyzeWithContext } from '@/lib/services/aiService';
import { getVisionAchievement } from '@/lib/services/boardVisionAchievementService';
import {
  getDetailPegawai,
  assertBolehLihatPegawai,
} from '@/lib/services/employeeDetailService';
import { buildFeatureContext } from '@/lib/services/aiContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VisionBody = z.object({
  periodCode: z.string().max(50).optional().nullable(),
});

/**
 * GET/POST /api/v1/executive/ai/vision
 *
 * Menjawab pertanyaan BOD: sudah berapa persen visi & misi tercapai?
 * Angka resmi dari getVisionAchievement; model hanya menafsirkan angka itu
 * menjadi narasi + rekomendasi. `rekomendasi` null bila AI tak tersedia.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'ai:read');
    assertCan(session, 'analytics:manage');

    const body = VisionBody.safeParse(await req.json().catch(() => ({})));
    const periodCode = body.success && body.data.periodCode ? body.data.periodCode : undefined;

    const angka = await getVisionAchievement(db as any, periodCode);
    const ringkas = {
      visi: angka.vision,
      misi: angka.missions,
      periode: angka.periodCode,
      persentaseCapaian: angka.overallAchievementPercentage,
      persentaseTerukur: angka.measuredAchievementPercentage,
      cakupanPengukuran: angka.measurementCoveragePercentage,
      jumlahPilarTerukur: angka.pillars.filter((p) => p.measured).length,
      totalPilar: angka.totalWeight,
      pilarTerkuat: angka.analysis.strongestPillar,
      pilarTerlemah: angka.analysis.weakestPillar,
      jumlahPilarDiBawahTarget: angka.analysis.belowTargetPillarCount,
      jumlahPilarTanpaData: angka.analysis.noDataPillarCount,
      temuanTataKelola: angka.analysis.governanceFindings.map((g) => g.message),
    };

    const { insight, configured, failed } = await analyzeWithContext(
      { ...ringkas, instruksi: 'Jelaskan ketercapaian visi & misi perusahaan dalam persen.' },
      'visi-misi',
      session.role
    );

    return ok({
      angka: ringkas,
      rekomendasi: configured && !failed ? insight : null,
      providerReady: configured,
      failed,
    });
  } catch (err) {
    return problem(err, '/api/v1/executive/ai/vision');
  }
}
