import { NextRequest, NextResponse } from 'next/server';

// POST /api/v1/pre-employment/assessments
// PRD §11.2 — Mencatat skor seleksi & kalkulasi Quality of Hire (QoH)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      candidate_name,
      applied_position_id,
      hiring_requisition_id,
      psychometric_score,
      technical_test_score,
      competency_interview_score,
      recruitment_cost,
      time_to_fill_days,
    } = body;

    // Validate required fields
    if (!candidate_name || !applied_position_id || !hiring_requisition_id) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/validation-failed',
          title: 'Validation Error',
          status: 422,
          detail: 'Kolom candidate_name, applied_position_id, dan hiring_requisition_id wajib diisi.',
          instance: '/api/v1/pre-employment/assessments',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // PRD §3.1 PRE-02: QoH Formula
    // QoH = Rata-rata: (Psikometri + Teknis + Wawancara Kompetensi + Skor Probation)
    // Skor probation diasumsikan 0 pada fase rekrutmen (belum ada), jadi rata-rata 3 komponen
    const scores = [
      psychometric_score ?? 0,
      technical_test_score ?? 0,
      competency_interview_score ?? 0,
    ].filter((s) => s > 0);

    const computedQohScore = scores.length > 0
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : 0;

    const qohStatus = computedQohScore >= 85
      ? 'ABOVE_BENCHMARK'
      : computedQohScore >= 70
      ? 'WITHIN_RANGE'
      : 'BELOW_BENCHMARK';

    // PRD §3.1 PRE-03: Time-to-Fill SLA Check
    const slaStatus = (time_to_fill_days ?? 0) <= 25
      ? 'WITHIN_SLA'
      : (time_to_fill_days ?? 0) <= 45
      ? 'MANAGERIAL_SLA'
      : 'SLA_BREACHED';

    const assessmentId = `asmnt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return NextResponse.json(
      {
        status: 'success',
        data: {
          assessment_id: assessmentId,
          candidate_name,
          applied_position_id,
          hiring_requisition_id,
          scores: {
            psychometric_score: psychometric_score ?? null,
            technical_test_score: technical_test_score ?? null,
            competency_interview_score: competency_interview_score ?? null,
          },
          computed_qoh_score: computedQohScore,
          qoh_benchmark: 85.0,
          qoh_status: qohStatus,
          hiring_recommendation: computedQohScore >= 85
            ? 'PROCEED_TO_OFFER'
            : computedQohScore >= 70
            ? 'PROCEED_WITH_REVIEW'
            : 'REJECT',
          recruitment_cost_idr: recruitment_cost ?? 0,
          time_to_fill_days: time_to_fill_days ?? null,
          sla_status: slaStatus,
          hiring_status: 'PENDING_OFFER',
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
        detail: 'Gagal menyimpan data asesmen. Silakan coba kembali.',
        instance: '/api/v1/pre-employment/assessments',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
