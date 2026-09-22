import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as analyticsService from '@/lib/services/analyticsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/analytics/benchmark-gap
// PRD §11.2 — Data komparasi radar chart kinerja vs benchmark industri
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const periodCode = searchParams.get('period_code') || '2026-Q3';

    const scorecard = await analyticsService.getVmaiScorecardData(db, periodCode);

    const benchmarkData = {
      period_code: periodCode,
      company_name: 'PT E-PerformIQ Nusantara',
      radar_chart_data: {
        perspectives: [
          {
            perspective: 'FINANCIAL',
            perspective_label: 'Kinerja Finansial',
            company_score: scorecard.perspectives.financial.score,
            industry_best_practice: 90.0,
            bumn_average: 82.0,
            industry_bottom_quartile: 70.0,
            variance_vs_best: Number((scorecard.perspectives.financial.score - 90.0).toFixed(2)),
            status: scorecard.perspectives.financial.score >= 90 ? 'ABOVE_BEST_PRACTICE' : 'NEAR_BEST_PRACTICE',
            key_driver: scorecard.perspectives.financial.driver,
            risk_note: null,
          },
          {
            perspective: 'CUSTOMER',
            perspective_label: 'Kepuasan Pelanggan/Stakeholder',
            company_score: scorecard.perspectives.customer.score,
            industry_best_practice: 88.0,
            bumn_average: 78.5,
            industry_bottom_quartile: 65.0,
            variance_vs_best: Number((scorecard.perspectives.customer.score - 88.0).toFixed(2)),
            status: scorecard.perspectives.customer.score >= 88 ? 'ABOVE_BEST_PRACTICE' : 'NEAR_BEST_PRACTICE',
            key_driver: scorecard.perspectives.customer.driver,
            risk_note: 'Pantau indeks kepuasan CSAT & SLA onboarding secara berkala.',
          },
          {
            perspective: 'INTERNAL_PROCESS',
            perspective_label: 'Keunggulan Proses Internal',
            company_score: scorecard.perspectives.internalProcess.score,
            industry_best_practice: 92.0,
            bumn_average: 80.0,
            industry_bottom_quartile: 60.0,
            variance_vs_best: Number((scorecard.perspectives.internalProcess.score - 92.0).toFixed(2)),
            status: scorecard.perspectives.internalProcess.score >= 92 ? 'ABOVE_BEST_PRACTICE' : 'NEAR_BEST_PRACTICE',
            key_driver: scorecard.perspectives.internalProcess.driver,
            risk_note: null,
          },
          {
            perspective: 'LEARNING_GROWTH',
            perspective_label: 'Pembelajaran & Pertumbuhan SDM',
            company_score: scorecard.perspectives.learningGrowth.score,
            industry_best_practice: 88.0,
            bumn_average: 76.0,
            industry_bottom_quartile: 58.0,
            variance_vs_best: Number((scorecard.perspectives.learningGrowth.score - 88.0).toFixed(2)),
            status: scorecard.perspectives.learningGrowth.score >= 88 ? 'ABOVE_BEST_PRACTICE' : 'BELOW_BEST_PRACTICE',
            key_driver: scorecard.perspectives.learningGrowth.driver,
            risk_note: 'Rekomendasi: eskalasi program pelatihan mandatori 24 jam & retensi talenta Top 20%.',
          },
        ],
      },
      overall_assessment: {
        vmai_score: scorecard.overallVMAI,
        industry_best_practice_vmai: 85.00,
        bumn_average_vmai: 78.50,
        variance_vs_bumn_avg: Number((scorecard.overallVMAI - 78.50).toFixed(2)),
        variance_vs_best_practice: Number((scorecard.overallVMAI - 85.00).toFixed(2)),
        standing: scorecard.overallVMAI >= 90 ? 'LEADER' : 'ABOVE_AVERAGE',
        gc_compliance_multiplier: scorecard.gcgComplianceFactor,
        strategic_status: scorecard.alignmentStatus,
        narrative: `Kinerja korporasi tercatat pada indeks VMAI ${scorecard.overallVMAI}%. Seluruh pencapaian terekam dalam GCG compliance scorecard.`,
      },
      comparable_peers: [
        { company: 'BUMN Tech A (Anonim)', vmai_score: 86.5, status: 'ABOVE_BENCHMARK' },
        { company: 'BUMN Finance B (Anonim)', vmai_score: 82.1, status: 'WITHIN_STANDARD' },
        { company: 'BUMN Energy C (Anonim)', vmai_score: 79.3, status: 'SUB_STANDARD' },
      ],
      benchmark_source: 'ISO 30414:2019 & Malcolm Baldrige KPKU Framework — Internal Synthesis Q3 2026',
      generated_at: new Date().toISOString(),
    };

    return ok(benchmarkData);
  } catch (err) {
    return problem(err, '/api/v1/analytics/benchmark-gap');
  }
}
