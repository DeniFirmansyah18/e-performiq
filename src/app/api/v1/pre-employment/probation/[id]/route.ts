import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_ONBOARDING as DUMMY_ONBOARDING_MILESTONES } from '@/lib/dummy-data';

interface Params {
  params: { id: string };
}

// PUT /api/v1/pre-employment/probation/:id
// PRD §11.2 — Mengisi evaluasi berkala 30, 60, 90 hari onboarding (oleh People Manager / HR Manager)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      day_30_score,
      day_60_score,
      day_90_score,
      manager_notes,
    } = body;

    if (!id) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/missing-parameter',
          title: 'Missing Parameter',
          status: 400,
          detail: 'ID milestone onboarding wajib disertakan di URL path.',
          instance: `/api/v1/pre-employment/probation/${id}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Lookup existing record
    const existing = DUMMY_ONBOARDING_MILESTONES.find((m) => m.id === id || m.employeeId === id);

    if (!existing) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/record-not-found',
          title: 'Not Found',
          status: 404,
          detail: `Data milestone onboarding dengan ID '${id}' tidak ditemukan.`,
          instance: `/api/v1/pre-employment/probation/${id}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // PRD §3.1 PRE-05: Onboarding Assimilation Index
    // Target: >= 80% pada hari ke-90
    const finalScore = day_90_score ?? (existing as any).day90Score ?? (existing as any).day_90_score ?? 0;
    const probationPassed = finalScore >= 80.0;

    const updatedMilestone = {
      ...existing,
      day30Score: day_30_score ?? (existing as any).day30Score ?? (existing as any).day_30_score,
      day60Score: day_60_score ?? (existing as any).day60Score ?? (existing as any).day_60_score,
      day90Score: day_90_score ?? (existing as any).day90Score ?? (existing as any).day_90_score,
      managerNotes: manager_notes ?? (existing as any).managerNotes ?? (existing as any).manager_notes,
      probationPassed,
      conversionDate: probationPassed ? new Date().toISOString().split('T')[0] : null,
    };

    // Assimilation index based on available scores
    const availableScores = [
      updatedMilestone.day30Score,
      updatedMilestone.day60Score,
      updatedMilestone.day90Score,
    ].filter((s): s is number => s !== null && s !== undefined);

    const assimilationIndex = availableScores.length > 0
      ? Number((availableScores.reduce((a, b) => a + b, 0) / availableScores.length).toFixed(2))
      : 0;

    return NextResponse.json({
      status: 'success',
      data: {
        milestone_id: existing.id,
        employee_id: existing.employeeId,
        day_30_score: updatedMilestone.day30Score,
        day_60_score: updatedMilestone.day60Score,
        day_90_score: updatedMilestone.day90Score,
        assimilation_index: assimilationIndex,
        benchmark_target_pct: 80.0,
        probation_passed: probationPassed,
        conversion_recommendation: probationPassed
          ? 'CONVERT_TO_PERMANENT (PKWTT)'
          : finalScore > 0
          ? 'EXTEND_PROBATION_30_DAYS'
          : 'EVALUATION_PENDING',
        conversion_date: updatedMilestone.conversionDate,
        manager_notes: updatedMilestone.managerNotes,
        audit_note: `Evaluasi probation diperbarui pada ${new Date().toISOString()} oleh PEOPLE_MANAGER.`,
        updated_at: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Gagal memperbarui data milestone. Silakan coba kembali.',
        instance: '/api/v1/pre-employment/probation',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
