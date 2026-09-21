import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { NineBoxQuadrant } from '@/types';

export interface UpsertAppraisalInput {
  periodId: string;
  employeeId: string;
  kpiCompositeScore: number;
  sopComplianceScore: number;
  competencyScore: number;
  coreValuesScore: number;
  totalPercentageScore: number;
  compositeGPA: number;
  performanceRating: string;
  potentialScore: number;
  nineBoxQuadrant: NineBoxQuadrant;
}

function formatAppraisal(row: any) {
  if (!row) return null;
  return {
    ...row,
    kpiCompositeScore: Number(row.kpiCompositeScore),
    sopComplianceScore: Number(row.sopComplianceScore),
    competencyScore: Number(row.competencyScore),
    coreValuesScore: Number(row.coreValuesScore),
    totalPercentageScore: Number(row.totalPercentageScore),
    compositeGPA: Number(row.compositeGPA),
    potentialScore: Number(row.potentialScore),
  };
}

export async function selectAppraisalByEmployee(db: Db, employeeId: string, periodId: string) {
  const result = await db.execute(sql`
    SELECT id, period_id as "periodId", employee_id as "employeeId",
           kpi_composite_score as "kpiCompositeScore", sop_compliance_score as "sopComplianceScore",
           competency_score as "competencyScore", core_values_score as "coreValuesScore",
           total_percentage_score as "totalPercentageScore", composite_gpa as "compositeGPA",
           performance_rating as "performanceRating", potential_score as "potentialScore",
           nine_box_quadrant as "nineBoxQuadrant", is_calibrated as "isCalibrated",
           calibrated_by as "calibratedBy", calibrated_at as "calibratedAt",
           calibration_notes as "calibrationNotes", created_at as "createdAt", updated_at as "updatedAt"
      FROM performance_appraisals
     WHERE employee_id = ${employeeId}::uuid
       AND period_id = ${periodId}::uuid
  `);
  return formatAppraisal(result.rows[0]);
}

export async function selectAppraisalById(db: Db, id: string) {
  const result = await db.execute(sql`
    SELECT id, period_id as "periodId", employee_id as "employeeId",
           kpi_composite_score as "kpiCompositeScore", sop_compliance_score as "sopComplianceScore",
           competency_score as "competencyScore", core_values_score as "coreValuesScore",
           total_percentage_score as "totalPercentageScore", composite_gpa as "compositeGPA",
           performance_rating as "performanceRating", potential_score as "potentialScore",
           nine_box_quadrant as "nineBoxQuadrant", is_calibrated as "isCalibrated",
           calibrated_by as "calibratedBy", calibrated_at as "calibratedAt",
           calibration_notes as "calibrationNotes", created_at as "createdAt", updated_at as "updatedAt"
      FROM performance_appraisals
     WHERE id = ${id}::uuid
  `);
  return formatAppraisal(result.rows[0]);
}

export async function upsertPerformanceAppraisal(db: Db, data: UpsertAppraisalInput) {
  const result = await db.execute(sql`
    INSERT INTO performance_appraisals (
      period_id, employee_id, kpi_composite_score, sop_compliance_score,
      competency_score, core_values_score, total_percentage_score,
      composite_gpa, performance_rating, potential_score, nine_box_quadrant
    ) VALUES (
      ${data.periodId}::uuid,
      ${data.employeeId}::uuid,
      ${data.kpiCompositeScore},
      ${data.sopComplianceScore},
      ${data.competencyScore},
      ${data.coreValuesScore},
      ${data.totalPercentageScore},
      ${data.compositeGPA},
      ${data.performanceRating},
      ${data.potentialScore},
      ${data.nineBoxQuadrant}
    )
    ON CONFLICT (period_id, employee_id) DO UPDATE SET
      kpi_composite_score = EXCLUDED.kpi_composite_score,
      sop_compliance_score = EXCLUDED.sop_compliance_score,
      competency_score = EXCLUDED.competency_score,
      core_values_score = EXCLUDED.core_values_score,
      total_percentage_score = EXCLUDED.total_percentage_score,
      composite_gpa = EXCLUDED.composite_gpa,
      performance_rating = EXCLUDED.performance_rating,
      potential_score = EXCLUDED.potential_score,
      nine_box_quadrant = EXCLUDED.nine_box_quadrant,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, period_id as "periodId", employee_id as "employeeId",
              kpi_composite_score as "kpiCompositeScore",
              sop_compliance_score as "sopComplianceScore",
              competency_score as "competencyScore",
              core_values_score as "coreValuesScore",
              total_percentage_score as "totalPercentageScore",
              composite_gpa as "compositeGPA",
              performance_rating as "performanceRating",
              potential_score as "potentialScore",
              nine_box_quadrant as "nineBoxQuadrant",
              is_calibrated as "isCalibrated"
  `);
  return formatAppraisal(result.rows[0]);
}

export async function setAppraisalCalibrated(
  db: Db,
  id: string,
  calibratorUserId: string,
  notes?: string
) {
  const result = await db.execute(sql`
    UPDATE performance_appraisals
       SET is_calibrated = TRUE,
           calibrated_by = ${calibratorUserId}::uuid,
           calibrated_at = CURRENT_TIMESTAMP,
           calibration_notes = ${notes ?? 'Dikalibrasi oleh Komite Kinerja'},
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${id}::uuid
    RETURNING id, period_id as "periodId", employee_id as "employeeId",
              kpi_composite_score as "kpiCompositeScore",
              sop_compliance_score as "sopComplianceScore",
              competency_score as "competencyScore",
              core_values_score as "coreValuesScore",
              total_percentage_score as "totalPercentageScore",
              composite_gpa as "compositeGPA",
              performance_rating as "performanceRating",
              potential_score as "potentialScore",
              nine_box_quadrant as "nineBoxQuadrant",
              is_calibrated as "isCalibrated",
              calibrated_by as "calibratedBy",
              calibrated_at as "calibratedAt",
              calibration_notes as "calibrationNotes"
  `);
  return formatAppraisal(result.rows[0]);
}
