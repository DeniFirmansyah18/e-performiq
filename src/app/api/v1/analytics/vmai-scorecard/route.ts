import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as analyticsService from '@/lib/services/analyticsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/analytics/vmai-scorecard (PRD Section 11.3)
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('period_id') || '2026-Q3';

    const scorecard = await analyticsService.getVmaiScorecardData(db, periodId);

    return ok({
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
    });
  } catch (err) {
    return problem(err, '/api/v1/analytics/vmai-scorecard');
  }
}
