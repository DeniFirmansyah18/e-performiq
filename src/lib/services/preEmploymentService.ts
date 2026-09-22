import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { BusinessRuleError } from '@/lib/auth/errors';
import {
  selectMppSummary,
  insertAssessment,
  selectOnboardingList,
  updateProbationStatus,
  CreateAssessmentInput,
} from '@/lib/repositories/preEmploymentRepository';
import { logAction } from './auditService';

export async function getMppSummaryData(db: Db, fiscalYear = 2026) {
  const { plans, assessments } = await selectMppSummary(db, fiscalYear);

  const totalApprovedQuota = plans.reduce((acc, p) => acc + Number(p.approvedQuota), 0);
  const totalHired = plans.reduce((acc, p) => acc + Number(p.hiredCount), 0);
  const totalAllocatedBudget = plans.reduce((acc, p) => acc + Number(p.allocatedBudgetIdr), 0);
  const totalUtilizedBudget = plans.reduce((acc, p) => acc + Number(p.utilizedBudgetIdr), 0);

  const mppFulfillmentRate = totalApprovedQuota > 0
    ? Number(((totalHired / totalApprovedQuota) * 100).toFixed(2))
    : 0;

  const qohScores = assessments.map((a) => Number(a.computedQoH));
  const avgQoH = qohScores.length > 0
    ? Number((qohScores.reduce((a, b) => a + b, 0) / qohScores.length).toFixed(2))
    : 0;

  const timeToFillDays = assessments.map((a) => Number(a.timeToFillDays || 0)).filter((d) => d > 0);
  const avgTimeToFill = timeToFillDays.length > 0
    ? Number((timeToFillDays.reduce((a, b) => a + b, 0) / timeToFillDays.length).toFixed(1))
    : 0;

  return {
    fiscal_year: fiscalYear,
    period_code: `${fiscalYear}-Q3`,
    summary: {
      total_approved_quota: totalApprovedQuota,
      total_hired: totalHired,
      total_remaining: totalApprovedQuota - totalHired,
      mpp_fulfillment_rate_pct: mppFulfillmentRate,
      allocated_budget_idr: totalAllocatedBudget,
      utilized_budget_idr: totalUtilizedBudget,
      benchmark_fulfillment_target_pct: 95.0,
      fulfillment_status: mppFulfillmentRate >= 95 ? 'ON_TARGET' : mppFulfillmentRate >= 80 ? 'NEAR_TARGET' : 'BELOW_TARGET',
    },
    quality_of_hire: {
      avg_qoh_score: avgQoH,
      benchmark_target: 85.0,
      qoh_status: avgQoH >= 85 ? 'ABOVE_BENCHMARK' : 'BELOW_BENCHMARK',
      total_candidates_assessed: assessments.length,
    },
    time_to_fill: {
      avg_days: avgTimeToFill,
      benchmark_managerial_days: 45,
      benchmark_staff_days: 25,
      sla_status: avgTimeToFill <= 30 ? 'WITHIN_SLA' : 'SLA_BREACHED',
    },
    departmental_breakdown: plans.map((p) => ({
      plan_id: p.planId,
      department_id: p.departmentId,
      department_name: p.departmentName,
      position_id: p.positionId,
      position_title: p.positionTitle,
      approved_quota: Number(p.approvedQuota),
      hired_count: Number(p.hiredCount),
      remaining: Number(p.approvedQuota) - Number(p.hiredCount),
      fulfillment_rate_pct: Number(p.approvedQuota) > 0
        ? Number(((Number(p.hiredCount) / Number(p.approvedQuota)) * 100).toFixed(2))
        : 0,
      allocated_budget_idr: Number(p.allocatedBudgetIdr),
      utilized_budget_idr: Number(p.utilizedBudgetIdr),
    })),
  };
}

export async function registerCandidateAssessment(
  db: Db,
  session: SessionPayload,
  data: CreateAssessmentInput
) {
  if (!['SUPER_ADMIN', 'HR_MANAGER'].includes(session.role)) {
    throw new BusinessRuleError('Hanya HR_MANAGER atau SUPER_ADMIN yang dapat mendaftarkan skor seleksi kandidat.');
  }

  // Calculate QoH weighted average: Psychometric (30%) + Technical (40%) + Interview (30%)
  const computedQoH = Number(
    (data.psychometricScore * 0.30 + data.technicalTestScore * 0.40 + data.competencyInterviewScore * 0.30).toFixed(2)
  );

  const created = await insertAssessment(db, {
    ...data,
    computedQohScore: computedQoH,
  });

  await logAction(db, {
    userId: session.userId,
    actionType: 'CREATE',
    entityName: 'recruitment_assessments',
    recordId: created.id,
    newData: created,
    description: `Asesmen seleksi kandidat '${data.candidateName}' (QoH: ${computedQoH})`,
  });

  return created;
}

export async function getOnboardingMilestones(db: Db) {
  return selectOnboardingList(db);
}

export async function evaluateProbationMilestone(
  db: Db,
  session: SessionPayload,
  onboardingId: string,
  scores: {
    day30Score?: number;
    day60Score?: number;
    day90Score?: number;
    managerNotes?: string;
    probationPassed?: boolean;
  }
) {
  if (!['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'].includes(session.role)) {
    throw new BusinessRuleError('Anda tidak memiliki wewenang untuk mengisi evaluasi probation.');
  }

  const conversionDate = scores.probationPassed ? new Date().toISOString().split('T')[0] : undefined;

  const updated = await updateProbationStatus(db, onboardingId, {
    ...scores,
    conversionDate,
  });

  await logAction(db, {
    userId: session.userId,
    actionType: scores.probationPassed ? 'CALIBRATE' : 'UPDATE',
    entityName: 'onboarding_milestones',
    recordId: onboardingId,
    newData: updated,
    description: scores.probationPassed
      ? `Pengangkatan karyawan probation ke status Tetap (PKWTT) ID: ${updated.employeeId}`
      : `Pembaruan skor evaluasi onboarding ID: ${onboardingId}`,
  });

  return updated;
}
