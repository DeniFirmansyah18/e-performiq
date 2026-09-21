import { NextResponse } from 'next/server';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';

// POST /api/v1/performance/appraisals/calculate-gpa (PRD Section 11.3)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      period_id = '2026-Q3',
      employee_id = '3c5d8e72-1b2a-4f55-9a88-29e84b7a102c',
      kpi_actual_score = 92.5,
      sop_compliance_score = 96.0,
      competency_gap_score = 85.0,
      core_values_360_score = 90.0,
      potential_assessment_score = 3.8,
    } = body;

    const result = calculateCompositeGPA({
      kpiScore: kpi_actual_score,
      sopScore: sop_compliance_score,
      competencyScore: competency_gap_score,
      coreValuesScore: core_values_360_score,
      potentialScore: potential_assessment_score,
    });

    return NextResponse.json({
      status: 'success',
      data: {
        appraisal_id: '7b2d1f99-5e4a-4d33-8a11-09f72a5e443b',
        employee_code: 'EMP-2022-0042',
        full_name: 'Budi Pratama',
        breakdown: {
          kpi_weighted: result.breakdown.kpiWeighted,
          sop_weighted: result.breakdown.sopWeighted,
          competency_weighted: result.breakdown.competencyWeighted,
          core_values_weighted: result.breakdown.coreValuesWeighted,
        },
        total_percentage_score: result.totalPercentage,
        composite_gpa: result.compositeGPA,
        performance_rating: result.rating,
        nine_box_placement: {
          quadrant: result.nineBoxQuadrant,
          performance_level: result.totalPercentage >= 90 ? 'HIGH' : 'MEDIUM',
          potential_level: potential_assessment_score >= 4.0 ? 'HIGH' : 'MEDIUM',
          strategic_action: result.ratingDescription,
        },
        calculated_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 }
    );
  }
}
