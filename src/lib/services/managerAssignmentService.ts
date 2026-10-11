/**
 * HR: penugasan atasan langsung (manager_id) untuk seorang karyawan.
 * Menulis satu baris audit_logs. Guard: tidak boleh menunjuk diri sendiri,
 * atasan & bawahan harus ada, dan tidak boleh membentuk siklus ke atas.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { logAction } from '@/lib/services/auditService';

export async function setEmployeeManager(
  db: Db,
  employeeId: string,
  managerId: string | null,
  actorUserId: string
) {
  if (managerId && managerId === employeeId) {
    throw new BusinessRuleError('Atasan langsung tidak boleh diri sendiri.');
  }

  const empRes = (await db.execute(sql`
    SELECT id, manager_id AS "managerId" FROM employees WHERE id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ id: string; managerId: string | null }> };
  if (!empRes.rows[0]) throw new BusinessRuleError('Karyawan tidak ditemukan.');

  if (managerId) {
    const mgr = (await db.execute(sql`
      SELECT id FROM employees WHERE id = ${managerId}::uuid
    `)) as unknown as { rows: Array<{ id: string }> };
    if (!mgr.rows[0]) throw new BusinessRuleError('Calon atasan tidak ditemukan.');

    // Tolak bila managerId adalah bawahan dari employeeId (cegah siklus).
    const cycle = (await db.execute(sql`
      WITH RECURSIVE subs AS (
        SELECT id, manager_id, 0 AS depth FROM employees WHERE id = ${employeeId}::uuid
        UNION ALL
        SELECT e.id, e.manager_id, s.depth + 1
          FROM employees e JOIN subs s ON e.manager_id = s.id
         WHERE s.depth < 5
      )
      SELECT id FROM subs WHERE id = ${managerId}::uuid LIMIT 1
    `)) as unknown as { rows: Array<{ id: string }> };
    if (cycle.rows[0]) {
      throw new BusinessRuleError('Tidak bisa menjadikan bawahan sebagai atasan langsung (akan membentuk siklus).');
    }
  }

  await db.execute(sql`
    UPDATE employees SET manager_id = ${managerId}::uuid WHERE id = ${employeeId}::uuid
  `);

  await logAction(db, {
    userId: actorUserId,
    actionType: 'UPDATE',
    entityName: 'employees',
    recordId: employeeId,
    oldData: { managerId: empRes.rows[0].managerId },
    newData: { managerId },
    description: 'HR menetapkan atasan langsung',
  });

  return { employeeId, managerId };
}
