import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface CreateAssessmentInput {
  candidateName: string;
  appliedPositionId: string;
  hiringRequisitionId: string;
  psychometricScore: number;
  technicalTestScore: number;
  competencyInterviewScore: number;
  computedQohScore: number;
  recruitmentCost?: number;
  timeToFillDays?: number;
  hiringStatus?: string;
}

export async function selectMppSummary(db: Db, fiscalYear = 2026) {
  const plansResult = await db.execute(sql`
    SELECT mp.id as "planId", mp.fiscal_year as "fiscalYear",
           mp.approved_quota as "approvedQuota", mp.hired_count as "hiredCount",
           mp.allocated_budget as "allocatedBudgetIdr", mp.utilized_budget as "utilizedBudgetIdr",
           d.id as "departmentId", d.department_name as "departmentName",
           jp.id as "positionId", jp.position_title as "positionTitle"
      FROM manpower_plans mp
      JOIN departments d ON d.id = mp.department_id
      JOIN job_positions jp ON jp.id = mp.position_id
     WHERE mp.fiscal_year = ${fiscalYear}
     ORDER BY d.department_name ASC
  `);

  const assessmentsResult = await db.execute(sql`
    SELECT id, candidate_name as "candidateName", computed_qoh_score as "computedQoH",
           time_to_fill_days as "timeToFillDays", hiring_status as "hiringStatus",
           recruitment_cost as "recruitmentCost"
      FROM recruitment_assessments
  `);

  return {
    plans: plansResult.rows as any[],
    assessments: assessmentsResult.rows as any[],
  };
}

export async function insertAssessment(db: Db, input: CreateAssessmentInput) {
  const result = await db.execute(sql`
    INSERT INTO recruitment_assessments (
      candidate_name, applied_position_id, hiring_requisition_id,
      psychometric_score, technical_test_score, competency_interview_score,
      computed_qoh_score, recruitment_cost, time_to_fill_days, hiring_status
    ) VALUES (
      ${input.candidateName},
      ${input.appliedPositionId}::uuid,
      ${input.hiringRequisitionId}::uuid,
      ${input.psychometricScore},
      ${input.technicalTestScore},
      ${input.competencyInterviewScore},
      ${input.computedQohScore},
      ${input.recruitmentCost ?? 0},
      ${input.timeToFillDays ?? 0},
      ${input.hiringStatus ?? 'HIRED'}
    ) RETURNING id, candidate_name as "candidateName", computed_qoh_score as "computedQoH", hiring_status as "hiringStatus"
  `);
  return result.rows[0] as any;
}

export async function selectOnboardingList(db: Db) {
  const result = await db.execute(sql`
    SELECT om.id, om.employee_id as "employeeId",
           om.day_30_score as "day30Score", om.day_60_score as "day60Score",
           om.day_90_score as "day90Score", om.manager_notes as "managerNotes",
           om.probation_passed as "probationPassed", om.conversion_date as "conversionDate",
           e.full_name as "employeeName", e.employee_code as "employeeCode",
           jp.position_title as "position", d.department_name as "department"
      FROM onboarding_milestones om
      JOIN employees e ON e.id = om.employee_id
      JOIN job_positions jp ON jp.id = e.position_id
      JOIN departments d ON d.id = e.department_id
     ORDER BY om.created_at DESC
  `);
  return result.rows as any[];
}

export async function updateProbationStatus(
  db: Db,
  id: string,
  data: {
    day30Score?: number;
    day60Score?: number;
    day90Score?: number;
    managerNotes?: string;
    probationPassed?: boolean;
    conversionDate?: string;
  }
) {
  const result = await db.execute(sql`
    UPDATE onboarding_milestones
       SET day_30_score = COALESCE(${data.day30Score ?? null}, day_30_score),
           day_60_score = COALESCE(${data.day60Score ?? null}, day_60_score),
           day_90_score = COALESCE(${data.day90Score ?? null}, day_90_score),
           manager_notes = COALESCE(${data.managerNotes ?? null}, manager_notes),
           probation_passed = COALESCE(${data.probationPassed ?? null}, probation_passed),
           conversion_date = COALESCE(${data.conversionDate ? sql`${data.conversionDate}::date` : null}, conversion_date)
     WHERE id = ${id}::uuid
    RETURNING id, employee_id as "employeeId", probation_passed as "probationPassed", conversion_date as "conversionDate"
  `);

  const updated = result.rows[0] as any;
  if (updated && data.probationPassed) {
    // Convert employee status to PERMANENT
    await db.execute(sql`
      UPDATE employees SET status = 'PERMANENT' WHERE id = ${updated.employeeId}::uuid
    `);
  }
  return updated;
}
