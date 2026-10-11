import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { logAction } from './auditService';

export interface ImprovementIdeaInput {
  employeeId: string;
  periodId?: string;
  title: string;
  description?: string;
  estimatedSavingIdr?: number;
}

export async function submitImprovementIdea(db: Db, session: SessionPayload, input: ImprovementIdeaInput) {
  const employeeId = input.employeeId || session.employeeId;
  if (!employeeId) throw new Error('employee_id wajib diisi');

  // Karyawan boleh mengusulkan untuk dirinya; HR/manager boleh untuk bawahannya.
  assertCan(session, 'kpi:read');
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, employeeId);

  const ins = (await db.execute(sql`
    INSERT INTO improvement_ideas (employee_id, period_id, title, description, estimated_saving_idr)
    VALUES (${employeeId}::uuid, ${input.periodId ?? null}::uuid, ${input.title},
            ${input.description ?? null}, ${input.estimatedSavingIdr ?? null})
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };

  await logAction(db, {
    userId: session.userId,
    actionType: 'CREATE',
    entityName: 'improvement_ideas',
    recordId: ins.rows[0].id,
    newData: input,
    description: `Usulan perbaikan (Kaizen) oleh karyawan ${employeeId}`,
  });

  return { id: ins.rows[0].id };
}

export async function listImprovementIdeas(
  db: Db,
  session: SessionPayload,
  opts: { employeeId?: string; periodId?: string } = {}
) {
  const scope = await resolveVisibleEmployeeIds(db, session);
  const res = (await db.execute(sql`
    SELECT i.id, i.employee_id AS "employeeId", e.full_name AS "fullName",
           i.period_id AS "periodId", i.title, i.description,
           i.estimated_saving_idr AS "estimatedSavingIdr", i.status, i.submitted_at AS "submittedAt"
      FROM improvement_ideas i
      JOIN employees e ON e.id = i.employee_id
     WHERE ${opts.employeeId ? sql`i.employee_id = ${opts.employeeId}::uuid` : sql`TRUE`}
       AND ${opts.periodId ? sql`i.period_id = ${opts.periodId}::uuid` : sql`TRUE`}
     ORDER BY i.submitted_at DESC
  `)) as unknown as { rows: Array<Record<string, unknown>> };

  const visible = (res.rows ?? []).filter((r) => scope === 'ALL' || scope.includes(String(r.employeeId)));
  const approved = visible.filter((r) => r.status === 'APPROVED' || r.status === 'IMPLEMENTED');
  return { total: visible.length, approvedCount: approved.length, items: visible };
}

export async function decideImprovementIdea(
  db: Db,
  session: SessionPayload,
  id: string,
  status: 'APPROVED' | 'REJECTED' | 'IMPLEMENTED',
  notes?: string
) {
  assertCan(session, 'kpi:approve');
  await db.execute(sql`
    UPDATE improvement_ideas
       SET status = ${status}, reviewer_id = ${session.userId}::uuid,
           reviewer_notes = ${notes ?? null}, decided_at = CURRENT_TIMESTAMP
     WHERE id = ${id}::uuid
  `);
  return { id, status };
}
