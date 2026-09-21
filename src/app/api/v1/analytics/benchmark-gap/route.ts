import { NextRequest, NextResponse } from 'next/server';

// GET /api/v1/analytics/benchmark-gap
// PRD §11.2 — Data komparasi radar chart kinerja vs benchmark industri
// PRD §5.4 — Vision & Mission Radar Chart
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodCode = searchParams.get('period_code') || '2026-Q3';

  // PRD §4.2 VMAI Thresholds & Industry benchmarks
  const benchmarkData = {
    period_code: periodCode,
    company_name: 'PT E-PerformIQ Nusantara',
    radar_chart_data: {
      perspectives: [
        {
          perspective: 'FINANCIAL',
          perspective_label: 'Kinerja Finansial',
          company_score: 92.40,
          industry_best_practice: 90.0,
          bumn_average: 82.0,
          industry_bottom_quartile: 70.0,
          variance_vs_best: 2.40,
          status: 'ABOVE_BEST_PRACTICE',
          key_driver: 'MPP Budget Adherence & Cost Efficiency',
          risk_note: null,
        },
        {
          perspective: 'CUSTOMER',
          perspective_label: 'Kepuasan Pelanggan/Stakeholder',
          company_score: 87.10,
          industry_best_practice: 88.0,
          bumn_average: 78.5,
          industry_bottom_quartile: 65.0,
          variance_vs_best: -0.90,
          status: 'NEAR_BEST_PRACTICE',
          key_driver: 'Internal CSAT & Onboarding Index',
          risk_note: 'Deviasi -0.9% dari best practice industri. Pantau NPS rekrutmen semester depan.',
        },
        {
          perspective: 'INTERNAL_PROCESS',
          perspective_label: 'Keunggulan Proses Internal',
          company_score: 94.80,
          industry_best_practice: 92.0,
          bumn_average: 80.0,
          industry_bottom_quartile: 60.0,
          variance_vs_best: 2.80,
          status: 'ABOVE_BEST_PRACTICE',
          key_driver: 'Zero Fatal SOP Error & Operational SLA Adherence',
          risk_note: null,
        },
        {
          perspective: 'LEARNING_GROWTH',
          perspective_label: 'Pembelajaran & Pertumbuhan SDM',
          company_score: 83.30,
          industry_best_practice: 88.0,
          bumn_average: 76.0,
          industry_bottom_quartile: 58.0,
          variance_vs_best: -4.70,
          status: 'BELOW_BEST_PRACTICE',
          key_driver: 'Mandatory Training Hours & Talent Retention Rate',
          risk_note: '⚠️ Defisit -4.7% vs best practice. Rekomendasi: eskalasi program IDP dan retensi Top 20% Talent.',
        },
      ],
    },
    overall_assessment: {
      vmai_score: 89.40,
      industry_best_practice_vmai: 85.00,
      bumn_average_vmai: 78.50,
      variance_vs_bumn_avg: 10.90,
      variance_vs_best_practice: 4.40,
      standing: 'ABOVE_AVERAGE',
      gc_compliance_multiplier: 1.00,
      strategic_status: 'HEALTHY_AND_ALIGNED',
      narrative: 'Kinerja SDM korporasi berada di atas rata-rata industri BUMN (78.5%) dan benchmark industri terkemuka (85.0%). Perhatian diperlukan pada pilar Pembelajaran & Pertumbuhan yang masih defisit 4.7% dari standar industri terbaik.',
    },
    comparable_peers: [
      { company: 'BUMN Tech A (Anonim)', vmai_score: 86.5, status: 'ABOVE_BENCHMARK' },
      { company: 'BUMN Finance B (Anonim)', vmai_score: 82.1, status: 'WITHIN_STANDARD' },
      { company: 'BUMN Energy C (Anonim)', vmai_score: 79.3, status: 'SUB_STANDARD' },
    ],
    benchmark_source: 'ISO 30414:2019 & Malcolm Baldrige KPKU Framework — Internal Synthesis Q3 2026',
    generated_at: new Date().toISOString(),
  };

  return NextResponse.json({
    status: 'success',
    data: benchmarkData,
  });
}
