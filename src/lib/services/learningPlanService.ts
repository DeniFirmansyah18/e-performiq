import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETE';
export type PlanItemStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

/** Membuat Individual Development Plan (IDP). */
export async function createPlan(
  db: Db,
  payload: { employeeId: string; title: string; periodId?: string | null; status?: PlanStatus }
) {
  const res = (await db.execute(sql`
    INSERT INTO learning_plans (employee_id, title, status, period_id)
    VALUES (${payload.employeeId}::uuid, ${payload.title}, ${(payload.status ?? 'ACTIVE')}::plan_status_enum, ${payload.periodId ?? null}::uuid)
    RETURNING id, employee_id AS "employeeId", title, status
  `)) as unknown as { rows: any[] };
  return res.rows[0];
}

/** Menambah item IDP (kompetensi/kursus target). */
export async function addPlanItem(
  db: Db,
  payload: { planId: string; competencyId?: string | null; courseId?: number | null; targetLevel?: number; status?: PlanItemStatus }
) {
  const res = (await db.execute(sql`
    INSERT INTO learning_plan_items (plan_id, competency_id, course_id, target_level, status)
    VALUES (${payload.planId}::uuid, ${payload.competencyId ?? null}::uuid, ${payload.courseId ?? null}, ${payload.targetLevel ?? null}, ${(payload.status ?? 'TODO')}::plan_item_status_enum)
    RETURNING id, plan_id AS "planId", status
  `)) as unknown as { rows: any[] };
  return res.rows[0];
}

/** Memperbarui status item IDP. */
export async function advancePlanItem(db: Db, itemId: string, status: PlanItemStatus) {
  const res = (await db.execute(sql`
    UPDATE learning_plan_items SET status = ${status}::plan_item_status_enum
     WHERE id = ${itemId}::uuid
     RETURNING id, plan_id AS "planId", status
  `)) as unknown as { rows: any[] };
  return res.rows[0];
}

/** Mengambil plan + item milik seorang karyawan. */
export async function getPlansForEmployee(db: Db, employeeId: string) {
  const plans = (await db.execute(sql`
    SELECT id, title, status, period_id AS "periodId" FROM learning_plans
     WHERE employee_id = ${employeeId}::uuid ORDER BY created_at DESC
  `)) as unknown as { rows: any[] };
  const result = [] as any[];
  for (const p of plans.rows ?? []) {
    const items = (await db.execute(sql`
      SELECT id, competency_id AS "competencyId", course_id AS "courseId", target_level AS "targetLevel", status
        FROM learning_plan_items WHERE plan_id = ${p.id}::uuid
    `)) as unknown as { rows: any[] };
    result.push({ ...p, items: items.rows ?? [] });
  }
  return result;
}
