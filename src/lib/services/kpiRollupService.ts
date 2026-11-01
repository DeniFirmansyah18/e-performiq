import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { BusinessRuleError } from '@/lib/auth/errors';
import { rollupPeriod } from './dailyPerformanceService';
import { logAction } from './auditService';

export interface RollupSummary {
  employeeId: string;
  periodId: string;
  updated: number;
}

/**
 * Menarik realisasi harian (status SUBMITTED/VERIFIED) menjadi nilai capaian
 * `individual_kpis.actual_value` pada satu periode penilaian.
 *
 * Tanpa langkah ini realisasi harian tidak pernah menjadi capaian KPI periode,
 * sehingga GPA dan VMAI hanya berisi angka manual.
 */
export async function rollupEmployeePeriod(
  db: Db,
  session: SessionPayload,
  employeeId: string,
  periodId: string,
): Promise<RollupSummary> {
  assertCan(session, 'kpi:write');
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, employeeId);

  const period = (await db.execute(sql`
    SELECT id FROM appraisal_periods WHERE id = ${periodId}::uuid LIMIT 1
  `)) as unknown as { rows: unknown[] };
  if (!period.rows?.length) {
    throw new BusinessRuleError(`Periode penilaian '${periodId}' tidak ditemukan.`);
  }

  const result = await rollupPeriod(db, employeeId, periodId);

  await logAction(db, {
    userId: session.userId,
    actionType: 'UPDATE',
    entityName: 'individual_kpis',
    recordId: employeeId,
    newData: { periodId, updated: result.updated },
    description: `Tarik realisasi harian ke capaian KPI periode (${result.updated} KPI diperbarui)`,
  });

  return { employeeId, periodId, updated: result.updated };
}
