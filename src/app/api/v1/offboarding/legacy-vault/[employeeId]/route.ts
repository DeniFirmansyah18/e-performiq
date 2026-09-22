import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as offboardingService from '@/lib/services/offboardingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { employeeId: string };
}

// GET /api/v1/offboarding/legacy-vault/:employeeId
// PRD §11.2 — Mengambil portofolio kontribusi seumur hidup (LCI) karyawan
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await getAuthSession(req);
    const { employeeId } = params;

    const contributions = await offboardingService.getLegacyVault(db, employeeId);

    const totalLciPoints = contributions.reduce((acc: number, c: any) => acc + (Number(c.pointsAwarded) || 0), 0);
    const totalQuantifiedImpact = contributions.reduce((acc: number, c: any) => acc + (Number(c.quantifiedImpactIdr) || 0), 0);

    return ok({
      employee_id: employeeId,
      legacy_vault: {
        total_contributions: contributions.length,
        total_lci_points: totalLciPoints,
        lci_hall_of_fame_eligible: totalLciPoints >= 100,
        total_quantified_impact_idr: totalQuantifiedImpact,
        items: contributions.map((c: any) => ({
          contribution_id: c.id,
          achievement_title: c.achievementTitle,
          achievement_type: c.achievementType,
          quantified_impact_idr: Number(c.quantifiedImpactIdr),
          points_awarded: Number(c.pointsAwarded),
          date_achieved: c.dateAchieved,
        })),
      },
      standard: 'PST-05: Lifetime Contribution Index (LCI) — Terarsip dalam Talent Legacy Hall of Fame',
      retrieved_at: new Date().toISOString(),
    });
  } catch (err) {
    return problem(err, `/api/v1/offboarding/legacy-vault/${params.employeeId}`);
  }
}
