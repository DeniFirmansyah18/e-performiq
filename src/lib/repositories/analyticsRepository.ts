import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { StrategicPillar } from '@/types';

export async function selectActivePillars(db: Db): Promise<StrategicPillar[]> {
  const result = await db.execute(sql`
    SELECT id, perspective, pillar_name as "pillarName", description,
           strategic_weight as "strategicWeight",
           92.4 as "achievedScore", 100 as "targetScore"
      FROM strategic_pillars
     WHERE is_active = TRUE
     ORDER BY perspective ASC
  `);

  return result.rows.map((row: any) => ({
    id: row.id,
    perspective: row.perspective,
    pillarName: row.pillarName,
    description: row.description,
    strategicWeight: Number(row.strategicWeight),
    achievedScore: Number(row.achievedScore),
    targetScore: Number(row.targetScore),
  }));
}

export async function selectAppraisalsForNineBox(db: Db, periodId?: string) {
  const result = await db.execute(sql`
    SELECT pa.id, pa.employee_id as "employeeId", pa.period_id as "periodId",
           pa.total_percentage_score as "totalPercentageScore",
           pa.composite_gpa as "compositeGPA",
           pa.performance_rating as "performanceRating",
           pa.potential_score as "potentialScore",
           pa.nine_box_quadrant as "nineBoxQuadrant",
           e.full_name as "fullName", e.employee_code as "employeeCode",
           d.department_name as "department", jp.position_title as "position"
      FROM performance_appraisals pa
      JOIN employees e ON e.id = pa.employee_id
      JOIN departments d ON d.id = e.department_id
      JOIN job_positions jp ON jp.id = e.position_id
     ${periodId ? sql`WHERE pa.period_id = ${periodId}::uuid` : sql``}
  `);
  return result.rows as any[];
}

export async function selectCascadingData(db: Db, perspectiveFilter?: string) {
  const pillarsResult = await db.execute(sql`
    SELECT id, perspective, pillar_name as "pillarName", description,
           strategic_weight as "strategicWeight"
      FROM strategic_pillars
     WHERE is_active = TRUE
       ${perspectiveFilter ? sql`AND perspective = ${perspectiveFilter}` : sql``}
  `);

  const corpKpisResult = await db.execute(sql`
    SELECT id, strategic_pillar_id as "strategicPillarId", kpi_code as "kpiCode",
           kpi_name as "kpiName", target_value as "targetValue", unit_of_measure as "unit"
      FROM corporate_kpis
  `);

  const divKpisResult = await db.execute(sql`
    SELECT id, corporate_kpi_id as "corporateKpiId", department_id as "departmentId",
           kpi_title as "kpiTitle", target_value as "targetValue", weight_pct as "weightPct"
      FROM division_kpis
  `);

  const indKpisResult = await db.execute(sql`
    SELECT id, division_kpi_id as "divisionKpiId", strategic_pillar_id as "strategicPillarId",
           employee_id as "employeeId", kpi_title as "kpiTitle", target_value as "targetValue",
           actual_value as "actualValue", achievement_percentage as "achievementPct"
      FROM individual_kpis
  `);

  return {
    pillars: pillarsResult.rows as any[],
    corpKpis: corpKpisResult.rows as any[],
    divKpis: divKpisResult.rows as any[],
    indKpis: indKpisResult.rows as any[],
  };
}

export async function insert360Review(
  db: Db,
  data: {
    periodId: string;
    evaluateeId: string;
    evaluatorId: string;
    relationshipType: string;
    integrityScore: number;
    collaborationScore: number;
    innovationScore: number;
    feedbackNotes?: string;
  }
) {
  const result = await db.execute(sql`
    INSERT INTO peer_reviews_360 (
      period_id, evaluatee_id, evaluator_id, relationship_type,
      integrity_score, collaboration_score, innovation_score, feedback_notes
    ) VALUES (
      ${data.periodId}::uuid,
      ${data.evaluateeId}::uuid,
      ${data.evaluatorId}::uuid,
      ${data.relationshipType},
      ${data.integrityScore},
      ${data.collaborationScore},
      ${data.innovationScore},
      ${data.feedbackNotes ?? null}
    ) RETURNING id, evaluatee_id as "evaluateeId", average_core_value_score as "averageScore"
  `);
  return result.rows[0] as any;
}
