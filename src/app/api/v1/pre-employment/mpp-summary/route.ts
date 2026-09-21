import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_MANPOWER_PLANS, DUMMY_RECRUITMENT as DUMMY_RECRUITMENT_ASSESSMENTS } from '@/lib/dummy-data';

// GET /api/v1/pre-employment/mpp-summary
// PRD §11.2 — Mengambil data realisasi formasi SDM vs kuota budget
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fiscalYear = searchParams.get('fiscal_year') || '2026';
  const departmentId = searchParams.get('department_id');

  let plans = DUMMY_MANPOWER_PLANS;
  if (departmentId) {
    plans = plans.filter((p) => p.department === departmentId);
  }

  const totalApprovedQuota = plans.reduce((acc, p) => acc + p.approvedQuota, 0);
  const totalHired = plans.reduce((acc, p) => acc + p.hiredCount, 0);
  const totalBudget = plans.reduce((acc, p) => acc + p.allocatedBudget, 0);

  const mppFulfillmentRate = totalApprovedQuota > 0
    ? Number(((totalHired / totalApprovedQuota) * 100).toFixed(2))
    : 0;

  // Compute average QoH from recruitment assessments
  const qohScores = DUMMY_RECRUITMENT_ASSESSMENTS.map((r) => r.computedQoH);
  const avgQoH = qohScores.length > 0
    ? Number((qohScores.reduce((a, b) => a + b, 0) / qohScores.length).toFixed(2))
    : 0;

  const avgTimeToFill = DUMMY_RECRUITMENT_ASSESSMENTS.length > 0
    ? Number((DUMMY_RECRUITMENT_ASSESSMENTS.reduce((acc, r) => acc + (r.timeToFillDays || 0), 0) / DUMMY_RECRUITMENT_ASSESSMENTS.length).toFixed(1))
    : 0;

  // PRE-01: MPP Alignment Ratio — target 95%-100%
  // PRE-02: Quality of Hire — target >= 85/100
  // PRE-03: Time-to-Fill SLA — target Manajerial <=45 hari, Staf <=25 hari

  return NextResponse.json({
    status: 'success',
    data: {
      fiscal_year: Number(fiscalYear),
      period_code: `${fiscalYear}-Q3`,
      summary: {
        total_approved_quota: totalApprovedQuota,
        total_hired: totalHired,
        total_remaining: totalApprovedQuota - totalHired,
        mpp_fulfillment_rate_pct: mppFulfillmentRate,
        allocated_budget_idr: totalBudget,
        benchmark_fulfillment_target_pct: 95.0,
        fulfillment_status: mppFulfillmentRate >= 95 ? 'ON_TARGET' : mppFulfillmentRate >= 80 ? 'NEAR_TARGET' : 'BELOW_TARGET',
      },
      quality_of_hire: {
        avg_qoh_score: avgQoH,
        benchmark_target: 85.0,
        qoh_status: avgQoH >= 85 ? 'ABOVE_BENCHMARK' : 'BELOW_BENCHMARK',
        total_candidates_assessed: DUMMY_RECRUITMENT_ASSESSMENTS.length,
      },
      time_to_fill: {
        avg_days: avgTimeToFill,
        benchmark_managerial_days: 45,
        benchmark_staff_days: 25,
        sla_status: avgTimeToFill <= 30 ? 'WITHIN_SLA' : 'SLA_BREACHED',
      },
      departmental_breakdown: plans.map((p) => ({
        plan_id: p.id,
        department_id: p.department,
        position_id: p.position,
        approved_quota: p.approvedQuota,
        hired_count: p.hiredCount,
        remaining: p.approvedQuota - p.hiredCount,
        fulfillment_rate_pct: p.approvedQuota > 0
          ? Number(((p.hiredCount / p.approvedQuota) * 100).toFixed(2))
          : 0,
        allocated_budget_idr: p.allocatedBudget,
      })),
      generated_at: new Date().toISOString(),
    },
  });
}
