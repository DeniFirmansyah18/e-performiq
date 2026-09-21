import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_LCI } from '@/lib/dummy-data';

interface Params {
  params: { employeeId: string };
}

// GET /api/v1/offboarding/legacy-vault/:employeeId
// PRD §11.2 — Mengambil portofolio kontribusi seumur hidup (LCI) karyawan
// PRD §5.3 — Alumni Legacy Registry
// PRD §3.3 PST-05 — Lifetime Contribution Index (LCI)
export async function GET(req: NextRequest, { params }: Params) {
  const { employeeId } = params;

  if (!employeeId) {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/missing-parameter',
        title: 'Missing Parameter',
        status: 400,
        detail: 'Employee ID wajib disertakan dalam URL path.',
        instance: '/api/v1/offboarding/legacy-vault',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  // Filter contributions for this employee
  const contributions = DUMMY_LCI.filter((lci) => lci.employeeId === employeeId);

  if (contributions.length === 0) {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/record-not-found',
        title: 'Legacy Vault Not Found',
        status: 404,
        detail: `Tidak ada catatan Lifetime Contribution Index untuk employee ID '${employeeId}'. Mungkin karyawan belum memiliki kontribusi yang tercatat atau ID tidak valid.`,
        instance: `/api/v1/offboarding/legacy-vault/${employeeId}`,
        timestamp: new Date().toISOString(),
      },
      { status: 404 }
    );
  }

  // PRD §3.3 PST-05: LCI Formula
  // LCI = Σ (Skor KPI Tahunan × Bobot Peran) + Inovasi/Paten
  const totalLciPoints = contributions.reduce((acc, c) => acc + (c.pointsAwarded || 0), 0);
  const totalQuantifiedImpact = contributions.reduce((acc, c) => acc + (c.quantifiedImpactIdr || 0), 0);

  const patentCount = contributions.filter((c) => c.achievementType === 'PATENT').length;
  const kaizenCount = contributions.filter((c) => c.achievementType === 'KAIZEN_SAVING').length;
  const mentorshipCount = contributions.filter((c) => c.achievementType === 'MENTORSHIP').length;
  const revenueImpactCount = contributions.filter((c) => c.achievementType === 'REVENUE_IMPACT').length;

  return NextResponse.json({
    status: 'success',
    data: {
      employee_id: employeeId,
      legacy_vault: {
        total_contributions: contributions.length,
        total_lci_points: totalLciPoints,
        lci_hall_of_fame_eligible: totalLciPoints >= 100,
        total_quantified_impact_idr: totalQuantifiedImpact,
        contribution_summary: {
          patents: patentCount,
          kaizen_savings: kaizenCount,
          mentorships: mentorshipCount,
          revenue_impacts: revenueImpactCount,
        },
        items: contributions.map((c) => ({
          contribution_id: c.id,
          achievement_title: c.achievementTitle,
          achievement_type: c.achievementType,
          quantified_impact_idr: c.quantifiedImpactIdr,
          points_awarded: c.pointsAwarded,
          date_achieved: c.dateAchieved,
        })),
      },
      standard: 'PST-05: Lifetime Contribution Index (LCI) — Terarsip dalam Talent Legacy Hall of Fame',
      lci_formula: 'LCI = Σ (Skor KPI Tahunan × Bobot Peran) + Inovasi/Paten',
      retrieved_at: new Date().toISOString(),
    },
  });
}
