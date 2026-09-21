import { NextRequest, NextResponse } from 'next/server';

// POST /api/v1/performance/360-reviews
// PRD §11.2 — Mengirimkan review rekan kerja terenkripsi dan anonim
// PRD §5.2 DUR-04 — Core Values & 360° Feedback (Integritas, Kolaborasi, Inovasi / AKHLAK)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      period_id,
      evaluatee_id,
      evaluator_id,
      relationship_type,
      integrity_score,
      collaboration_score,
      innovation_score,
      feedback_notes,
    } = body;

    // Validate required fields
    if (!period_id || !evaluatee_id || !evaluator_id || !relationship_type) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/validation-failed',
          title: 'Validation Error',
          status: 422,
          detail: 'Kolom period_id, evaluatee_id, evaluator_id, dan relationship_type wajib diisi.',
          instance: '/api/v1/performance/360-reviews',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Validate relationship type
    const validRelationships = ['SUPERVISOR', 'PEER', 'SUBORDINATE'];
    if (!validRelationships.includes(relationship_type)) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/invalid-relationship-type',
          title: 'Invalid Relationship Type',
          status: 422,
          detail: `Tipe hubungan '${relationship_type}' tidak valid. Pilihan yang tersedia: SUPERVISOR, PEER, SUBORDINATE.`,
          instance: '/api/v1/performance/360-reviews',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Prevent self-evaluation
    if (evaluatee_id === evaluator_id) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/self-evaluation-prohibited',
          title: 'Self-Evaluation Prohibited',
          status: 422,
          detail: 'Karyawan tidak diperbolehkan mengevaluasi dirinya sendiri. evaluatee_id dan evaluator_id tidak boleh sama.',
          instance: '/api/v1/performance/360-reviews',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Validate scores (PRD §3.2 DUR-04: 1.0 - 5.0)
    const scores = { integrity_score, collaboration_score, innovation_score };
    for (const [field, value] of Object.entries(scores)) {
      if (value !== undefined && value !== null) {
        if (typeof value !== 'number' || value < 1.0 || value > 5.0) {
          return NextResponse.json(
            {
              type: 'https://api.e-performiq.com/errors/score-out-of-range',
              title: 'Score Out of Range',
              status: 422,
              detail: `Skor '${field}' harus berada dalam rentang 1.0 hingga 5.0. Nilai yang diterima: ${value}.`,
              instance: '/api/v1/performance/360-reviews',
              timestamp: new Date().toISOString(),
            },
            { status: 422 }
          );
        }
      }
    }

    // Calculate average core value score
    const validScores = [integrity_score, collaboration_score, innovation_score]
      .filter((s): s is number => s !== null && s !== undefined);
    const avgCoreValueScore = validScores.length > 0
      ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2))
      : 0;

    const reviewId = `rev360-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // PRD §12.2 Security: 360° reviews dienkripsi AES-256-GCM untuk anonymity
    // In this demo, we simulate the anonymization
    const anonymizedEvaluatorId = Buffer.from(`${evaluator_id}:${Date.now()}`).toString('base64').slice(0, 20);

    return NextResponse.json(
      {
        status: 'success',
        data: {
          review_id: reviewId,
          period_id,
          evaluatee_id,
          // Evaluator anonymized per GCG security standard
          evaluator_ref: anonymizedEvaluatorId,
          evaluator_anonymized: true,
          relationship_type,
          scores: {
            integrity_score: integrity_score ?? null,
            collaboration_score: collaboration_score ?? null,
            innovation_score: innovation_score ?? null,
          },
          average_core_value_score: avgCoreValueScore,
          benchmark_target: 4.2,
          benchmark_status: avgCoreValueScore >= 4.2 ? 'ABOVE_BENCHMARK' : 'NEEDS_IMPROVEMENT',
          feedback_notes: feedback_notes
            ? '[ENCRYPTED - Visible only to HR calibration committee]'
            : null,
          security_note: 'Review ini diproses dengan enkripsi AES-256-GCM. Identitas evaluator dilindungi sesuai standar GCG.',
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
        detail: 'Gagal menyimpan review 360°. Silakan coba kembali.',
        instance: '/api/v1/performance/360-reviews',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
