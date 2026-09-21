import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_APPRAISAL_BUDI as DUMMY_APPRAISAL, DUMMY_USERS } from '@/lib/dummy-data';

interface Params {
  params: { id: string };
}

// PUT /api/v1/performance/appraisals/:id/calibrate
// PRD §11.2 — Pengesahan nilai akhir oleh Komite Kalibrasi Kinerja
// PRD §6.2 — Immutability of Final Scores: nilai tidak bisa diubah tanpa persetujuan berjenjang
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      calibrated_by_user_id,
      calibration_notes,
      // Optional override scores (only allowed in calibration window)
      override_kpi_score,
      override_sop_score,
      override_competency_score,
      override_core_values_score,
    } = body;

    if (!id) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/missing-parameter',
          title: 'Missing Parameter',
          status: 400,
          detail: 'ID appraisal wajib disertakan di URL path.',
          instance: `/api/v1/performance/appraisals/${id}/calibrate`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!calibrated_by_user_id) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/missing-calibrator',
          title: 'Calibrator Required',
          status: 422,
          detail: 'ID pengesah (calibrated_by_user_id) wajib disertakan. Hanya HR_MANAGER atau BOD yang dapat mengesahkan nilai.',
          instance: `/api/v1/performance/appraisals/${id}/calibrate`,
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Verify calibrator role (must be HR_MANAGER or BOD)
    const calibrator = DUMMY_USERS.find((u) => u.id === calibrated_by_user_id);
    if (calibrator && !['HR_MANAGER', 'BOD'].includes(calibrator.role)) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/unauthorized-calibration',
          title: 'Unauthorized Calibration',
          status: 403,
          detail: `Peran '${calibrator.role}' tidak memiliki otorisasi untuk mengesahkan nilai akhir. Hanya HR_MANAGER dan BOD yang dapat menggunakan endpoint ini.`,
          instance: `/api/v1/performance/appraisals/${id}/calibrate`,
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Find the appraisal record
    const appraisals = [DUMMY_APPRAISAL]; // Extend with all appraisals in a real system
    const appraisal = appraisals.find((a) => a.id === id);
    if (!appraisal) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/record-not-found',
          title: 'Appraisal Not Found',
          status: 404,
          detail: `Data penilaian dengan ID '${id}' tidak ditemukan.`,
          instance: `/api/v1/performance/appraisals/${id}/calibrate`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // PRD §6.2: Check if already calibrated (immutability rule)
    if (appraisal.isCalibrated) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/immutable-record',
          title: 'Immutable Appraisal Record',
          status: 409,
          detail: `Nilai penilaian ID '${id}' telah disahkan oleh Komite Kalibrasi dan berstatus immutable. Perubahan hanya dapat dilakukan melalui persetujuan berjenjang Direktur HR dan tercatat di Audit Log GCG.`,
          instance: `/api/v1/performance/appraisals/${id}/calibrate`,
          timestamp: new Date().toISOString(),
          gcg_rule: 'PRD §6.2 — Immutability of Final Scores',
        },
        { status: 409 }
      );
    }

    // Recalculate if override scores provided
    const finalKpi = override_kpi_score ?? appraisal.kpiScore;
    const finalSop = override_sop_score ?? appraisal.sopScore;
    const finalComp = override_competency_score ?? appraisal.competencyScore;
    const finalValues = override_core_values_score ?? appraisal.coreValuesScore;

    const newTotal = Number(((finalKpi * 0.50) + (finalSop * 0.20) + (finalComp * 0.15) + (finalValues * 0.15)).toFixed(2));
    const newGPA = Number(Math.min(4.0, (newTotal / 100) * 4.0).toFixed(2));
    const newRating = newTotal >= 90 ? 'A' : newTotal >= 80 ? 'B' : newTotal >= 70 ? 'C' : 'D';

    // Generate immutable audit log entry
    const auditLogEntry = {
      log_id: `audit-${Date.now()}`,
      action_type: 'CALIBRATE',
      entity_name: 'performance_appraisals',
      record_id: id,
      calibrated_by_user_id,
      calibrator_name: calibrator?.name ?? 'Unknown',
      calibrator_role: calibrator?.role ?? 'UNKNOWN',
      old_data: {
        kpi_composite_score: appraisal.kpiScore,
        sop_compliance_score: appraisal.sopScore,
        competency_score: appraisal.competencyScore,
        core_values_score: appraisal.coreValuesScore,
        total_percentage_score: appraisal.totalPercentage,
        composite_gpa: appraisal.compositeGPA,
        is_calibrated: false,
      },
      new_data: {
        kpi_composite_score: finalKpi,
        sop_compliance_score: finalSop,
        competency_score: finalComp,
        core_values_score: finalValues,
        total_percentage_score: newTotal,
        composite_gpa: newGPA,
        performance_rating: newRating,
        is_calibrated: true,
        calibration_notes: calibration_notes ?? 'Dikalibrasi oleh Komite Kinerja',
      },
      ip_address: '192.168.1.1',
      calibrated_at: new Date().toISOString(),
      gcg_note: 'Log ini bersifat immutable. Terenkripsi dan tersimpan dalam GCG Audit Trail.',
    };

    return NextResponse.json({
      status: 'success',
      message: 'Nilai penilaian berhasil disahkan oleh Komite Kalibrasi dan telah dikunci.',
      data: {
        appraisal_id: id,
        employee_id: appraisal.employeeId,
        calibration_result: {
          kpi_composite_score: finalKpi,
          sop_compliance_score: finalSop,
          competency_score: finalComp,
          core_values_score: finalValues,
          total_percentage_score: newTotal,
          composite_gpa: newGPA,
          performance_rating: newRating,
        },
        is_calibrated: true,
        calibration_status: 'LOCKED',
        calibration_notes: calibration_notes ?? 'Dikalibrasi oleh Komite Kinerja',
        calibrated_by: {
          user_id: calibrated_by_user_id,
          name: calibrator?.name ?? 'Unknown',
          role: calibrator?.role ?? 'UNKNOWN',
        },
        audit_log: auditLogEntry,
        immutability_note: 'Nilai ini telah disahkan dan dikunci. Tidak dapat diubah tanpa persetujuan berjenjang Direktur HR.',
        calibrated_at: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Gagal mengesahkan nilai kalibrasi. Silakan coba kembali.',
        instance: '/api/v1/performance/appraisals/calibrate',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
