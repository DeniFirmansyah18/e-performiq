import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as appraisalService from '@/lib/services/appraisalService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CalculateGPASchema = z.object({
  period_id: z.string().min(1, 'period_id wajib diisi'),
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  kpi_actual_score: z.number().min(0).max(100),
  sop_compliance_score: z.number().min(0).max(100),
  competency_gap_score: z.number().min(0).max(100),
  core_values_360_score: z.number().min(0).max(100),
  potential_assessment_score: z.number().min(1).max(5).optional(),
  calibration_notes: z.string().optional(),
});

// POST /api/v1/performance/appraisals/calculate-gpa (PRD Section 11.3)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, CalculateGPASchema);

    const saved = await appraisalService.calculateAndSaveGPA(db, session, {
      periodId: body.period_id,
      employeeId: body.employee_id,
      kpiScore: body.kpi_actual_score,
      sopScore: body.sop_compliance_score,
      competencyScore: body.competency_gap_score,
      coreValuesScore: body.core_values_360_score,
      potentialScore: body.potential_assessment_score,
      notes: body.calibration_notes,
    });

    return ok({
      appraisal_id: saved.id,
      period_id: saved.periodId,
      employee_id: saved.employeeId,
      breakdown: {
        kpi_weighted: Number((saved.kpiCompositeScore * 0.50).toFixed(2)),
        sop_weighted: Number((saved.sopComplianceScore * 0.20).toFixed(2)),
        competency_weighted: Number((saved.competencyScore * 0.15).toFixed(2)),
        core_values_weighted: Number((saved.coreValuesScore * 0.15).toFixed(2)),
      },
      total_percentage_score: Number(saved.totalPercentageScore),
      composite_gpa: Number(saved.compositeGPA),
      performance_rating: saved.performanceRating,
      nine_box_placement: {
        quadrant: saved.nineBoxQuadrant,
        performance_level: saved.totalPercentageScore >= 90 ? 'HIGH' : 'MEDIUM',
        potential_level: (body.potential_assessment_score ?? 3.5) >= 4.0 ? 'HIGH' : 'MEDIUM',
        strategic_action: saved.nineBoxQuadrant,
      },
      is_calibrated: saved.isCalibrated,
      calculated_at: new Date().toISOString(),
    });
  } catch (err) {
    return problem(err, '/api/v1/performance/appraisals/calculate-gpa');
  }
}
