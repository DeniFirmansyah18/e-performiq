import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_STRATEGIC_PILLARS } from '@/lib/dummy-data';

// GET /api/v1/performance/cascading-tree
// PRD §11.2 — Mengambil visualisasi pohon cascading dari BSC Korporasi → Individu
// PRD §5.2 — Goal Cascading Tree
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const perspectiveFilter = searchParams.get('perspective'); // FINANCIAL | CUSTOMER | INTERNAL_PROCESS | LEARNING_GROWTH

  let pillars = DUMMY_STRATEGIC_PILLARS;
  if (perspectiveFilter) {
    pillars = pillars.filter((p) => p.perspective === perspectiveFilter);
  }

  const cascadingTree = {
    level_0_vision: {
      label: 'Visi Perusahaan',
      description: 'Menjadi Perusahaan Teknologi Terkemuka di Asia Tenggara yang Berdampak Nyata',
      type: 'VISION',
    },
    level_1_mission: [
      'Menyediakan solusi teknologi inovatif yang mendorong efisiensi & produktivitas nasional',
      'Membangun ekosistem SDM unggul berkomitmen tinggi berlandaskan GCG & integritas',
      'Mengoptimalkan nilai bagi seluruh pemangku kepentingan secara berkelanjutan',
    ],
    level_2_strategic_pillars: pillars.map((pillar) => ({
      pillar_id: pillar.id,
      perspective: pillar.perspective,
      pillar_name: pillar.pillarName,
      description: pillar.description,
      strategic_weight_pct: pillar.strategicWeight,
      achieved_score: pillar.achievedScore,
      target_score: pillar.targetScore,
      level_3_corporate_kpis: [
        {
          kpi_id: `corp-kpi-${pillar.perspective.toLowerCase()}-01`,
          kpi_code: `CORP-${pillar.perspective.substring(0, 3)}-01`,
          kpi_name: pillar.perspective === 'FINANCIAL'
            ? 'Revenue Growth vs RKAP Target'
            : pillar.perspective === 'CUSTOMER'
            ? 'Internal CSAT & NPS Score'
            : pillar.perspective === 'INTERNAL_PROCESS'
            ? 'Zero Fatal SOP & Operational SLA Adherence'
            : 'Training Hours & Talent Retention Rate',
          target_value: pillar.perspective === 'FINANCIAL' ? 15.0 : pillar.perspective === 'CUSTOMER' ? 90.0 : pillar.perspective === 'INTERNAL_PROCESS' ? 98.0 : 24.0,
          unit: pillar.perspective === 'FINANCIAL' ? '%_GROWTH' : pillar.perspective === 'CUSTOMER' ? '%_SCORE' : pillar.perspective === 'INTERNAL_PROCESS' ? '%_SLA' : 'JAM/TAHUN',
          period_code: '2026-Q3',
          level_4_division_kpis: [
            {
              division_kpi_id: `div-kpi-${pillar.perspective.toLowerCase()}-001`,
              division_name: 'Information Technology & Engineering',
              kpi_title: pillar.perspective === 'FINANCIAL'
                ? 'Cost Efficiency IT Infrastructure per Transaction'
                : pillar.perspective === 'CUSTOMER'
                ? 'System Uptime & User Satisfaction Score'
                : pillar.perspective === 'INTERNAL_PROCESS'
                ? 'Zero Critical Bug Production Release'
                : 'Engineer Skill Competency Level 4-5',
              weight_pct: 30,
              level_5_individual_kpi_sample: {
                employee_id: 'emp-emp-004',
                employee_name: 'Budi Pratama',
                kpi_title: pillar.perspective === 'FINANCIAL'
                  ? 'Optimisasi Biaya Infrastruktur Cloud per Kuartal'
                  : pillar.perspective === 'CUSTOMER'
                  ? 'Response Time API < 200ms pada 99.9% Request'
                  : pillar.perspective === 'INTERNAL_PROCESS'
                  ? 'Zero Critical Defect pada Enterprise Release Pipeline'
                  : 'Penyelesaian Sertifikasi Cloud Architect Profesional',
                target_value: 100,
                actual_value: pillar.perspective === 'FINANCIAL' ? 96.8 : pillar.perspective === 'CUSTOMER' ? 99.98 : pillar.perspective === 'INTERNAL_PROCESS' ? 100 : 92,
                weight_pct: 25,
                achievement_pct: pillar.perspective === 'FINANCIAL' ? 96.8 : pillar.perspective === 'CUSTOMER' ? 99.98 : pillar.perspective === 'INTERNAL_PROCESS' ? 100 : 92,
                cascade_valid: true,
              },
            },
          ],
        },
      ],
    })),
    framework: 'Balanced Scorecard (Kaplan & Norton) + OKR Framework',
    cascade_integrity_check: {
      all_individual_kpis_linked: true,
      orphan_kpi_count: 0,
      validation_status: 'PASSED',
      message: 'Seluruh KPI individu telah terhubung ke minimal 1 pilar strategis korporasi.',
    },
    generated_at: new Date().toISOString(),
  };

  return NextResponse.json({
    status: 'success',
    data: cascadingTree,
  });
}
