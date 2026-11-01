import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface CreateIndicatorInput {
  kpiId: string;
  indicatorName: string;
  unitOfMeasure?: string;
  targetValue: number;
  direction?: 'HIGHER_BETTER' | 'LOWER_BETTER';
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  aggregation?: 'SUM' | 'AVG' | 'LAST' | 'MAX';
  indicatorWeight?: number;
}

export interface UpdateIndicatorInput {
  indicatorName?: string;
  unitOfMeasure?: string;
  targetValue?: number;
  direction?: 'HIGHER_BETTER' | 'LOWER_BETTER';
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  aggregation?: 'SUM' | 'AVG' | 'LAST' | 'MAX';
  indicatorWeight?: number;
  isActive?: boolean;
}

const SELECT_COLUMNS = sql`
  i.id, i.kpi_id AS "kpiId", i.indicator_name AS "indicatorName",
  i.unit_of_measure AS "unitOfMeasure", i.target_value::float8 AS "targetValue",
  i.direction, i.frequency, i.aggregation,
  i.indicator_weight::float8 AS "indicatorWeight",
  i.is_active AS "isActive", i.created_at AS "createdAt"
`;

// Untuk klausa RETURNING / UPDATE, kolom direferensikan tanpa alias tabel.
const BARE_COLUMNS = sql`
  id, kpi_id AS "kpiId", indicator_name AS "indicatorName",
  unit_of_measure AS "unitOfMeasure", target_value::float8 AS "targetValue",
  direction, frequency, aggregation,
  indicator_weight::float8 AS "indicatorWeight",
  is_active AS "isActive", created_at AS "createdAt"
`;

export async function selectIndicatorsByKpi(db: Db, kpiId: string) {
  const res = (await db.execute(sql`
    SELECT ${SELECT_COLUMNS}
      FROM kpi_indicators i
     WHERE i.kpi_id = ${kpiId}::uuid
     ORDER BY i.created_at ASC
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}

export async function selectIndicatorsByEmployee(db: Db, employeeId: string, periodId?: string) {
  const res = (await db.execute(sql`
    SELECT ${SELECT_COLUMNS},
           k.kpi_title AS "kpiTitle",
           k.employee_id AS "employeeId",
           k.period_id AS "periodId"
      FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
     WHERE k.employee_id = ${employeeId}::uuid
       ${periodId ? sql`AND k.period_id = ${periodId}::uuid` : sql``}
     ORDER BY k.kpi_title ASC, i.created_at ASC
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}

export async function selectIndicatorById(db: Db, id: string) {
  const res = (await db.execute(sql`
    SELECT ${SELECT_COLUMNS}, k.employee_id AS "employeeId", k.period_id AS "periodId"
      FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
     WHERE i.id = ${id}::uuid
     LIMIT 1
  `)) as unknown as { rows: any[] };
  return res.rows?.[0] ?? null;
}

/**
 * Total bobot indikator aktif dalam satu KPI. Dipakai untuk menjaga bobot ≤ 100%
 * sehingga rollup periode tidak melebihkan kontribusi.
 */
export async function sumActiveIndicatorWeight(db: Db, kpiId: string, excludeId?: string) {
  const res = (await db.execute(sql`
    SELECT COALESCE(SUM(indicator_weight), 0)::float8 AS total
      FROM kpi_indicators
     WHERE kpi_id = ${kpiId}::uuid
       AND is_active = TRUE
       ${excludeId ? sql`AND id <> ${excludeId}::uuid` : sql``}
  `)) as unknown as { rows: Array<{ total: number }> };
  return Number(res.rows?.[0]?.total ?? 0);
}

export async function insertIndicator(db: Db, data: CreateIndicatorInput) {
  const res = (await db.execute(sql`
    INSERT INTO kpi_indicators
      (kpi_id, indicator_name, unit_of_measure, target_value, direction, frequency,
       aggregation, indicator_weight)
    VALUES (${data.kpiId}::uuid, ${data.indicatorName}, ${data.unitOfMeasure ?? '%'},
            ${data.targetValue}, ${data.direction ?? 'HIGHER_BETTER'}::kpi_direction_enum,
            ${data.frequency ?? 'DAILY'}::kpi_frequency_enum,
            ${data.aggregation ?? 'AVG'}::kpi_aggregation_enum,
            ${data.indicatorWeight ?? 100})
    RETURNING ${BARE_COLUMNS}
  `)) as unknown as { rows: any[] };
  return res.rows[0];
}

export async function updateIndicator(db: Db, id: string, data: UpdateIndicatorInput) {
  const res = (await db.execute(sql`
    UPDATE kpi_indicators SET
      indicator_name  = COALESCE(${data.indicatorName ?? null}, indicator_name),
      unit_of_measure = COALESCE(${data.unitOfMeasure ?? null}, unit_of_measure),
      target_value    = COALESCE(${data.targetValue ?? null}, target_value),
      direction       = COALESCE(${data.direction ?? null}::kpi_direction_enum, direction),
      frequency       = COALESCE(${data.frequency ?? null}::kpi_frequency_enum, frequency),
      aggregation     = COALESCE(${data.aggregation ?? null}::kpi_aggregation_enum, aggregation),
      indicator_weight = COALESCE(${data.indicatorWeight ?? null}, indicator_weight),
      is_active       = COALESCE(${data.isActive ?? null}, is_active)
    WHERE id = ${id}::uuid
    RETURNING ${BARE_COLUMNS}
  `)) as unknown as { rows: any[] };
  return res.rows?.[0] ?? null;
}

export async function deleteIndicator(db: Db, id: string) {
  const res = (await db.execute(sql`
    DELETE FROM kpi_indicators WHERE id = ${id}::uuid RETURNING id
  `)) as unknown as { rows: any[] };
  return res.rows?.[0] ?? null;
}
