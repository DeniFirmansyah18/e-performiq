import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from './session';
import { ForbiddenError } from './errors';

export type VisibleScope = string[] | 'ALL';

/** Role yang melihat seluruh organisasi (spec §6.3). */
const ORG_WIDE_ROLES = ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'AUDITOR', 'ASSESSOR'] as const;

/**
 * Recursive CTE dengan batas kedalaman 5. Batas ini mencegah query
 * menggantung selamanya bila data manager_id melingkar
 * (Review Focus butir 3).
 */
const MAX_DEPTH = 5;

export async function resolveVisibleEmployeeIds(
  db: Db,
  session: SessionPayload
): Promise<VisibleScope> {
  if ((ORG_WIDE_ROLES as readonly string[]).includes(session.role)) return 'ALL';

  if (!session.employeeId) return [];

  if (session.role === 'EMPLOYEE') return [session.employeeId];

  const result = await db.execute(sql`
    WITH RECURSIVE subordinates AS (
      SELECT id, manager_id, 0 AS depth
        FROM employees
       WHERE id = ${session.employeeId}::uuid
      UNION ALL
      SELECT e.id, e.manager_id, s.depth + 1
        FROM employees e
        JOIN subordinates s ON e.manager_id = s.id
       WHERE s.depth < ${MAX_DEPTH}
    )
    SELECT id FROM subordinates
  `);

  return (result.rows as Array<{ id: string }>).map((r) => r.id);
}

export function assertEmployeeVisible(scope: VisibleScope, employeeId: string): void {
  if (scope === 'ALL') return;
  if (!scope.includes(employeeId)) {
    throw new ForbiddenError(
      'Anda tidak memiliki otorisasi untuk mengakses data karyawan ini.'
    );
  }
}
