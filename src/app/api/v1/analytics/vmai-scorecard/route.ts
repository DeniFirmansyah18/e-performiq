import { NextResponse } from 'next/server';
import { calculateVMAI } from '@/lib/engines/vmai-engine';
import { DUMMY_STRATEGIC_PILLARS } from '@/lib/dummy-data';

// GET /api/v1/analytics/vmai-scorecard (PRD Section 11.3)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('period_id') || '2026-Q3';

    const scorecard = calculateVMAI(DUMMY_STRATEGIC_PILLARS, 1.0);

    return NextResponse.json({
      status: 'success',
      data: {
        period_code: periodId,
        vmai_score: scorecard.overallVMAI,
        alignment_status: scorecard.alignmentStatus,
        status_description: scorecard.statusDescription,
        balanced_scorecard_perspectives: {
          financial: {
            score: scorecard.perspectives.financial.score,
            status: scorecard.perspectives.financial.status,
            key_driver: scorecard.perspectives.financial.driver,
          },
          customer_stakeholder: {
            score: scorecard.perspectives.customer.score,
            status: scorecard.perspectives.customer.status,
            key_driver: scorecard.perspectives.customer.driver,
          },
          internal_business_process: {
            score: scorecard.perspectives.internalProcess.score,
            status: scorecard.perspectives.internalProcess.status,
            key_driver: scorecard.perspectives.internalProcess.driver,
          },
          learning_growth: {
            score: scorecard.perspectives.learningGrowth.score,
            status: scorecard.perspectives.learningGrowth.status,
            key_driver: scorecard.perspectives.learningGrowth.driver,
          },
        },
        gcg_governance_factor: scorecard.gcgComplianceFactor,
        industry_benchmark: {
          target_benchmark: scorecard.industryBenchmark.target,
          variance_percentage: scorecard.industryBenchmark.variance,
          standing: scorecard.industryBenchmark.standing,
        },
        total_evaluated_employees: scorecard.totalEmployees,
        generated_at: scorecard.generatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 }
    );
  }
}
