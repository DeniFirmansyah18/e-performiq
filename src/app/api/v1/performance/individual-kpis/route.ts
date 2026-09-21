import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_STRATEGIC_PILLARS } from '@/lib/dummy-data';

// POST /api/v1/performance/individual-kpis
// PRD §11.2 — Submit rencana sasaran kerja SMART tahunan/semesteran
// PRD §8 Acceptance Criteria — Sistem menolak KPI individual yang tidak terhubung minimal 1 pilar strategis
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      period_id,
      employee_id,
      strategic_pillar_id,  // MANDATORY per PRD §8 Acceptance Criteria
      corporate_kpi_id,
      kpi_title,
      target_value,
      actual_value,
      kpi_weight,
    } = body;

    // --- Validate required fields ---
    if (!period_id || !employee_id || !kpi_title || !target_value || !kpi_weight) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/validation-failed',
          title: 'Validation Error',
          status: 422,
          detail: 'Kolom period_id, employee_id, kpi_title, target_value, dan kpi_weight wajib diisi.',
          instance: '/api/v1/performance/individual-kpis',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // --- PRD §8 Acceptance Criteria (CRITICAL): Cascading Validation ---
    // "Sistem menolak pembuatan KPI individu yang tidak terhubung dengan minimal 1 sasaran strategis divisi/korporasi"
    if (!strategic_pillar_id) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/kpi-cascading-missing',
          title: 'Unlinked KPI Error (PRD §8 Acceptance Criteria)',
          status: 422,
          detail: `Pembuatan KPI individu gagal. KPI '${kpi_title}' wajib memiliki relasi ke minimal 1 Corporate Strategic Pillar (strategic_pillar_id). Gunakan endpoint GET /api/v1/performance/cascading-tree untuk melihat daftar pilar strategis yang tersedia.`,
          instance: '/api/v1/performance/individual-kpis',
          timestamp: new Date().toISOString(),
          validation_rule: 'CASCADING_REQUIRED',
          cascade_requirement: '100% KPI tervalidasi tautannya ke Strategic Pillar (ISO 30414 Compliant)',
        },
        { status: 422 }
      );
    }

    // --- Verify strategic_pillar_id exists ---
    const pillarExists = DUMMY_STRATEGIC_PILLARS.find((p) => p.id === strategic_pillar_id);
    if (!pillarExists) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/invalid-pillar-reference',
          title: 'Invalid Strategic Pillar Reference',
          status: 422,
          detail: `Strategic Pillar ID '${strategic_pillar_id}' tidak ditemukan dalam daftar pilar aktif. Gunakan GET /api/v1/performance/cascading-tree untuk memperoleh ID yang valid.`,
          instance: '/api/v1/performance/individual-kpis',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // --- Validate weight range (0-100) ---
    if (kpi_weight <= 0 || kpi_weight > 100) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/invalid-weight',
          title: 'Invalid KPI Weight',
          status: 422,
          detail: `Bobot KPI (kpi_weight) harus berada dalam rentang 0 < weight <= 100. Nilai yang diterima: ${kpi_weight}.`,
          instance: '/api/v1/performance/individual-kpis',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    const actualVal = actual_value ?? 0;
    const achievementPct = target_value > 0
      ? Number(((actualVal / target_value) * 100).toFixed(2))
      : 0;

    const kpiId = `ind-kpi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return NextResponse.json(
      {
        status: 'success',
        data: {
          kpi_id: kpiId,
          period_id,
          employee_id,
          strategic_pillar_id,
          pillar_details: {
            pillar_name: pillarExists.pillarName,
            perspective: pillarExists.perspective,
            strategic_weight_pct: pillarExists.strategicWeight,
          },
          corporate_kpi_id: corporate_kpi_id ?? null,
          kpi_title,
          target_value: Number(target_value),
          actual_value: actualVal,
          kpi_weight: Number(kpi_weight),
          achievement_percentage: achievementPct,
          cascade_validation: {
            is_linked_to_pillar: true,
            pillar_name: pillarExists.pillarName,
            cascade_status: 'VALIDATED',
            validation_rule: 'PRD §8 — 100% KPI tervalidasi tautannya',
          },
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Gagal menyimpan KPI individu. Silakan coba kembali.',
        instance: '/api/v1/performance/individual-kpis',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET /api/v1/performance/individual-kpis
// Return list of individual KPIs (with optional employee_id filter)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employee_id');
  const periodId = searchParams.get('period_id');

  const { DUMMY_BUDI_KPIS } = await import('@/lib/dummy-data');

  let kpis = DUMMY_BUDI_KPIS;
  if (employeeId) kpis = kpis.filter((k) => k.employeeId === employeeId);
  if (periodId) kpis = kpis.filter((k) => k.periodId === periodId);

  return NextResponse.json({
    status: 'success',
    data: {
      total: kpis.length,
      items: kpis.map((k) => ({
        kpi_id: k.id,
        employee_id: k.employeeId,
        kpi_title: k.kpiTitle,
        target_value: k.targetValue,
        actual_value: k.actualValue,
        kpi_weight: k.kpiWeight,
        achievement_pct: k.targetValue > 0
          ? Number(((k.actualValue / k.targetValue) * 100).toFixed(2))
          : 0,
      })),
      cascade_integrity: {
        all_linked_to_pillar: true,
        orphan_count: 0,
      },
    },
  });
}
