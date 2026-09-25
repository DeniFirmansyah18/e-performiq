import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { KpiStatus } from '@/types';

export interface CreateKpiInput {
  periodId: string;
  employeeId: string;
  strategicPillarId: string;
  divisionKpiId?: string;
  kpiTitle: string;
  targetValue: number;
  unitOfMeasure?: string;
  kpiWeight: number;
  status?: KpiStatus;
}

export async function selectKpisByEmployee(db: Db, employeeId: string, periodId?: string) {
  const result = await db.execute(sql`
    SELECT k.id, k.period_id as "periodId", k.employee_id as "employeeId",
           k.strategic_pillar_id as "strategicPillarId", k.division_kpi_id as "divisionKpiId",
           k.kpi_title as "kpiTitle", k.target_value as "targetValue", k.actual_value as "actualValue",
           k.unit_of_measure as "unit", k.kpi_weight as "kpiWeight",
           k.achievement_percentage as "achievementPercentage",
           k.status, k.approved_by as "approvedBy", k.approved_at as "approvedAt",
           k.created_at as "createdAt",
           sp.pillar_name as "strategicPillarName", sp.perspective,
           dk.kpi_title as "divisionKpiTitle"
      FROM individual_kpis k
      JOIN strategic_pillars sp ON sp.id = k.strategic_pillar_id
      LEFT JOIN division_kpis dk ON dk.id = k.division_kpi_id
     WHERE k.employee_id = ${employeeId}::uuid
       ${periodId ? sql`AND k.period_id = ${periodId}::uuid` : sql``}
     ORDER BY k.created_at ASC
  `);
  return result.rows as any[];
}

export async function selectKpiById(db: Db, id: string) {
  const result = await db.execute(sql`
    SELECT k.id, k.period_id as "periodId", k.employee_id as "employeeId",
           k.strategic_pillar_id as "strategicPillarId", k.division_kpi_id as "divisionKpiId",
           k.kpi_title as "kpiTitle", k.target_value as "targetValue", k.actual_value as "actualValue",
           k.unit_of_measure as "unit", k.kpi_weight as "kpiWeight",
           k.achievement_percentage as "achievementPercentage",
           k.status, k.approved_by as "approvedBy", k.approved_at as "approvedAt",
           k.created_at as "createdAt",
           sp.pillar_name as "strategicPillarName", sp.perspective
      FROM individual_kpis k
      JOIN strategic_pillars sp ON sp.id = k.strategic_pillar_id
     WHERE k.id = ${id}::uuid
  `);
  return (result.rows[0] as any) ?? null;
}

export async function calculateTotalWeight(
  db: Db,
  employeeId: string,
  periodId: string,
  excludeKpiId?: string
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(kpi_weight), 0)::text as total
      FROM individual_kpis
     WHERE employee_id = ${employeeId}::uuid
       AND period_id = ${periodId}::uuid
       ${excludeKpiId ? sql`AND id != ${excludeKpiId}::uuid` : sql``}
  `);
  return Number((result.rows[0] as any).total);
}

export async function verifyPillarExists(db: Db, pillarId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM strategic_pillars WHERE id = ${pillarId}::uuid
  `);
  return result.rows.length > 0;
}

export async function verifyDivisionKpiExists(db: Db, divisionKpiId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM division_kpis WHERE id = ${divisionKpiId}::uuid
  `);
  return result.rows.length > 0;
}

export async function insertIndividualKpi(db: Db, data: CreateKpiInput) {
  const result = await db.execute(sql`
    INSERT INTO individual_kpis (
      period_id, employee_id, strategic_pillar_id, division_kpi_id,
      kpi_title, target_value, actual_value, unit_of_measure, kpi_weight, status
    ) VALUES (
      ${data.periodId}::uuid,
      ${data.employeeId}::uuid,
      ${data.strategicPillarId}::uuid,
      ${data.divisionKpiId ? sql`${data.divisionKpiId}::uuid` : sql`NULL`},
      ${data.kpiTitle},
      ${data.targetValue},
      0,
      ${data.unitOfMeasure ?? '%'},
      ${data.kpiWeight},
      ${data.status ?? 'SUBMITTED'}
    )
    RETURNING id, period_id as "periodId", employee_id as "employeeId",
              kpi_title as "kpiTitle", target_value as "targetValue",
              actual_value as "actualValue", kpi_weight as "kpiWeight",
              achievement_percentage as "achievementPercentage", status
  `);
  return result.rows[0] as any;
}

export async function updateKpiActual(db: Db, id: string, actualValue: number) {
  const result = await db.execute(sql`
    UPDATE individual_kpis
       SET actual_value = ${actualValue}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ${id}::uuid
    RETURNING id, period_id as "periodId", employee_id as "employeeId",
              kpi_title as "kpiTitle", target_value as "targetValue",
              actual_value as "actualValue", kpi_weight as "kpiWeight",
              achievement_percentage as "achievementPercentage", status
  `);
  return result.rows[0] as any;
}

export async function updateKpiStatus(
  db: Db,
  id: string,
  status: KpiStatus,
  approverUserId?: string
) {
  const isApproverUuid = approverUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(approverUserId);

  const result = await db.execute(sql`
    UPDATE individual_kpis
       SET status = ${status},
           approved_by = ${isApproverUuid ? sql`${approverUserId}::uuid` : sql`NULL`},
           approved_at = ${status === 'APPROVED' ? sql`CURRENT_TIMESTAMP` : sql`NULL`},
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${id}::uuid
    RETURNING id, period_id as "periodId", employee_id as "employeeId",
              kpi_title as "kpiTitle", status, approved_by as "approvedBy",
              approved_at as "approvedAt"
  `);
  return result.rows[0] as any;
}

export async function updateKpiWeight(db: Db, id: string, kpiWeight: number) {
  const result = await db.execute(sql`
    UPDATE individual_kpis
       SET kpi_weight = ${kpiWeight}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ${id}::uuid
    RETURNING id, period_id as "periodId", employee_id as "employeeId",
              kpi_title as "kpiTitle", target_value as "targetValue",
              actual_value as "actualValue", kpi_weight as "kpiWeight",
              achievement_percentage as "achievementPercentage", status
  `);
  return result.rows[0] as any;
}

export async function deleteIndividualKpi(db: Db, id: string) {
  const result = await db.execute(sql`
    DELETE FROM individual_kpis
     WHERE id = ${id}::uuid
    RETURNING id, period_id as "periodId", employee_id as "employeeId",
              kpi_title as "kpiTitle", kpi_weight as "kpiWeight"
  `);
  return result.rows[0] as any;
}
