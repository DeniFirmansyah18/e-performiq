import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { computeSopScore } from '@/lib/engines/sop-scoring-engine';
import { logAction } from './auditService';

export interface SopMetricsInput {
  periodId: string;
  employeeId: string;
  totalAssignedTasks: number;
  tasksOnTime: number;
  errorCount: number;
  fatalErrorCount: number;
  auditFindingsCount?: number;
  notes?: string;
}

interface SopMetricsRow {
  periodId: string;
  employeeId: string;
  totalAssignedTasks: number;
  tasksOnTime: number;
  errorCount: number;
  fatalErrorCount: number;
  auditFindingsCount: number;
  notes: string | null;
}

/** Simpan (upsert) metrik kepatuhan SOP. RBAC appraisal:calculate + scope. */
export async function upsertSopMetrics(db: Db, session: SessionPayload, input: SopMetricsInput) {
  assertCan(session, 'appraisal:calculate');
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, input.employeeId);

  const existing = (await db.execute(sql`
    SELECT id FROM sop_period_metrics
     WHERE period_id = ${input.periodId}::uuid AND employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: Array<{ id: string }> };

  let resultId: string;
  if (existing.rows[0]) {
    resultId = existing.rows[0].id;
    await db.execute(sql`
      UPDATE sop_period_metrics
         SET total_assigned_tasks = ${input.totalAssignedTasks},
             tasks_on_time = ${input.tasksOnTime},
             error_count = ${input.errorCount},
             fatal_error_count = ${input.fatalErrorCount},
             audit_findings_count = ${input.auditFindingsCount ?? 0},
             notes = ${input.notes ?? null},
             recorded_by = ${session.userId}::uuid,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${resultId}::uuid
    `);
  } else {
    const ins = (await db.execute(sql`
      INSERT INTO sop_period_metrics
        (period_id, employee_id, total_assigned_tasks, tasks_on_time, error_count,
         fatal_error_count, audit_findings_count, notes, recorded_by)
      VALUES (${input.periodId}::uuid, ${input.employeeId}::uuid, ${input.totalAssignedTasks},
              ${input.tasksOnTime}, ${input.errorCount}, ${input.fatalErrorCount},
              ${input.auditFindingsCount ?? 0}, ${input.notes ?? null}, ${session.userId}::uuid)
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };
    resultId = ins.rows[0].id;
  }

  await logAction(db, {
    userId: session.userId,
    actionType: existing.rows[0] ? 'UPDATE' : 'CREATE',
    entityName: 'sop_period_metrics',
    recordId: resultId,
    newData: input,
    description: `Input metrik kepatuhan SOP untuk karyawan ${input.employeeId}`,
  });

  return getSopMetrics(db, input.employeeId, input.periodId);
}

export async function getSopMetrics(
  db: Db,
  employeeId: string,
  periodId: string
): Promise<(SopMetricsRow & { score: number; slaRate: number; errorRate: number }) | null> {
  const res = (await db.execute(sql`
    SELECT period_id AS "periodId", employee_id AS "employeeId",
           total_assigned_tasks AS "totalAssignedTasks", tasks_on_time AS "tasksOnTime",
           error_count AS "errorCount", fatal_error_count AS "fatalErrorCount",
           audit_findings_count AS "auditFindingsCount", notes
      FROM sop_period_metrics
     WHERE employee_id = ${employeeId}::uuid AND period_id = ${periodId}::uuid
  `)) as unknown as { rows: SopMetricsRow[] };

  const row = res.rows[0];
  if (!row) return null;

  const scored = computeSopScore({
    totalAssignedTasks: Number(row.totalAssignedTasks),
    tasksOnTime: Number(row.tasksOnTime),
    errorCount: Number(row.errorCount),
    fatalErrorCount: Number(row.fatalErrorCount),
  });

  return {
    ...row,
    totalAssignedTasks: Number(row.totalAssignedTasks),
    tasksOnTime: Number(row.tasksOnTime),
    errorCount: Number(row.errorCount),
    fatalErrorCount: Number(row.fatalErrorCount),
    auditFindingsCount: Number(row.auditFindingsCount),
    score: scored.score,
    slaRate: scored.slaRate,
    errorRate: scored.errorRate,
  };
}

export async function listSopMetrics(db: Db, session: SessionPayload, periodId: string) {
  const scope = await resolveVisibleEmployeeIds(db, session);
  const res = (await db.execute(sql`
    SELECT m.employee_id AS "employeeId", e.full_name AS "fullName", e.employee_code AS "employeeCode",
           m.total_assigned_tasks AS "totalAssignedTasks", m.tasks_on_time AS "tasksOnTime",
           m.error_count AS "errorCount", m.fatal_error_count AS "fatalErrorCount",
           m.audit_findings_count AS "auditFindingsCount", m.notes
      FROM sop_period_metrics m
      JOIN employees e ON e.id = m.employee_id
     WHERE m.period_id = ${periodId}::uuid
     ORDER BY e.full_name
  `)) as unknown as { rows: Array<Record<string, unknown>> };

  return (res.rows ?? [])
    .filter((r) => scope === 'ALL' || scope.includes(String(r.employeeId)))
    .map((r) => {
      const scored = computeSopScore({
        totalAssignedTasks: Number(r.totalAssignedTasks),
        tasksOnTime: Number(r.tasksOnTime),
        errorCount: Number(r.errorCount),
        fatalErrorCount: Number(r.fatalErrorCount),
      });
      return { ...r, score: scored.score, slaRate: scored.slaRate, errorRate: scored.errorRate };
    });
}
