import { NextRequest, NextResponse } from 'next/server';

// GET /api/v1/analytics/nine-box-distribution
// PRD §11.2 — Distribusi demografi talent grid 9-Box korporasi
// PRD §5.2 — 9-Box Talent Placement Matrix
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodCode = searchParams.get('period_code') || '2026-Q3';
  const directorateId = searchParams.get('directorate_id');

  // Full 9-Box distribution data (matching the ninebox-matrix dashboard)
  const nineBoxDistribution = [
    {
      quadrant_id: 9,
      quadrant_name: 'FUTURE_LEADER',
      quadrant_display: 'Future Leader',
      performance_level: 'HIGH',
      potential_level: 'HIGH',
      employee_count: 42,
      population_pct: 3.39,
      strategic_action: 'Fast-Track Leadership & Succession Pool',
      action_type: 'CRITICAL_INVESTMENT',
      color_hex: '#007a5a',
      recommended_intervention: 'Akselerasi program mentoring eksekutif, rotasi lintas divisi, dan penugasan proyek strategis C-Suite.',
    },
    {
      quadrant_id: 8,
      quadrant_name: 'GROWTH_STAR',
      quadrant_display: 'Growth Star',
      performance_level: 'HIGH',
      potential_level: 'MEDIUM',
      employee_count: 34,
      population_pct: 2.74,
      strategic_action: 'Mentoring & Stretch Assignment',
      action_type: 'DEVELOPMENT',
      color_hex: '#0284c7',
      recommended_intervention: 'Penugasan proyek lintas departemen dan program mentoring senior selama 6 bulan.',
    },
    {
      quadrant_id: 7,
      quadrant_name: 'ENIGMA',
      quadrant_display: 'Enigma',
      performance_level: 'LOW',
      potential_level: 'HIGH',
      employee_count: 8,
      population_pct: 0.65,
      strategic_action: 'Role Re-alignment',
      action_type: 'INVESTIGATION',
      color_hex: '#7c3aed',
      recommended_intervention: 'Identifikasi hambatan kinerja: misalignment peran, kondisi personal, atau beban adaptasi baru.',
    },
    {
      quadrant_id: 6,
      quadrant_name: 'HIGH_IMPACT',
      quadrant_display: 'High Impact',
      performance_level: 'HIGH',
      potential_level: 'LOW',
      employee_count: 95,
      population_pct: 7.66,
      strategic_action: 'Retention & Long-Term Incentives',
      action_type: 'RETENTION',
      color_hex: '#d97706',
      recommended_intervention: 'Paket retensi LTIP (Long-Term Incentive Plan), recognition formal, dan program SME specialist track.',
    },
    {
      quadrant_id: 5,
      quadrant_name: 'CORE_PLAYER',
      quadrant_display: 'Core Player',
      performance_level: 'MEDIUM',
      potential_level: 'MEDIUM',
      employee_count: 180,
      population_pct: 14.52,
      strategic_action: 'Lateral Enrichment',
      action_type: 'ENRICHMENT',
      color_hex: '#4f46e5',
      recommended_intervention: 'Rotasi lateral, proyek cross-functional, dan program kepemimpinan tingkat pertama.',
    },
    {
      quadrant_id: 4,
      quadrant_name: 'DILEMMA',
      quadrant_display: 'Dilemma',
      performance_level: 'MEDIUM',
      potential_level: 'LOW',
      employee_count: 14,
      population_pct: 1.13,
      strategic_action: 'Skill Upskilling Program',
      action_type: 'UPSKILLING',
      color_hex: '#0891b2',
      recommended_intervention: 'Reskilling kompetensi teknis dasar dan penetapan KPI yang lebih terukur dalam 90 hari.',
    },
    {
      quadrant_id: 3,
      quadrant_name: 'TRUSTED_PRO',
      quadrant_display: 'Trusted Pro',
      performance_level: 'LOW',
      potential_level: 'LOW',
      employee_count: 52,
      population_pct: 4.19,
      strategic_action: 'Key SME Retention',
      action_type: 'RETENTION',
      color_hex: '#059669',
      recommended_intervention: 'Pertahankan sebagai SME vital; susun Knowledge Preservation Plan untuk transfer pengetahuan.',
    },
    {
      quadrant_id: 2,
      quadrant_name: 'EFFECTIVE_PRO',
      quadrant_display: 'Effective Pro',
      performance_level: 'MEDIUM',
      potential_level: 'LOW',
      employee_count: 88,
      population_pct: 7.10,
      strategic_action: 'Skill Specialization',
      action_type: 'SPECIALIZATION',
      color_hex: '#64748b',
      recommended_intervention: 'Sertifikasi teknis spesialis dan pelibatan dalam proyek skala menengah.',
    },
    {
      quadrant_id: 1,
      quadrant_name: 'UNDERPERFORMER',
      quadrant_display: 'Underperformer',
      performance_level: 'LOW',
      potential_level: 'LOW',
      employee_count: 12,
      population_pct: 0.97,
      strategic_action: 'PIP Plan (60 Days)',
      action_type: 'INTERVENTION',
      color_hex: '#dc2626',
      recommended_intervention: '⚠️ Aktivasi Performance Improvement Plan (PIP) 60 hari dengan target kinerja terukur. Jika tidak memenuhi target, eskalasi ke HR & Legal untuk evaluasi hubungan kerja.',
    },
  ];

  const totalEmployees = nineBoxDistribution.reduce((acc, q) => acc + q.employee_count, 0);
  const topTierCount = nineBoxDistribution.filter((q) => [7, 8, 9].includes(q.quadrant_id)).reduce((acc, q) => acc + q.employee_count, 0);
  const atRiskCount = nineBoxDistribution.filter((q) => q.quadrant_id === 1).reduce((acc, q) => acc + q.employee_count, 0);
  const successorReadyCount = nineBoxDistribution.filter((q) => q.quadrant_id === 9)[0]?.employee_count ?? 0;

  return NextResponse.json({
    status: 'success',
    data: {
      period_code: periodCode,
      directorate_id: directorateId ?? 'ALL_DIRECTORATES',
      summary: {
        total_evaluated: totalEmployees,
        top_tier_count: topTierCount,
        top_tier_pct: Number(((topTierCount / totalEmployees) * 100).toFixed(2)),
        successor_ready_now: successorReadyCount,
        at_risk_count: atRiskCount,
        at_risk_pct: Number(((atRiskCount / totalEmployees) * 100).toFixed(2)),
        succession_coverage_ratio: `${successorReadyCount}:1`,
        gcg_note: 'Pemetaan 9-Box divalidasi oleh Komite Kalibrasi Kinerja (HR Manager + BOD). Terverifikasi GCG Cycle.',
      },
      quadrant_distribution: nineBoxDistribution,
      framework: '9-Box Talent Matrix (McKinsey/GE) — PRD §3.2 & §5.2',
      generated_at: new Date().toISOString(),
    },
  });
}
