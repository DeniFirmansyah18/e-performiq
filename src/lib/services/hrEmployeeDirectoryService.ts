/**
 * HR Employee Directory — daftar karyawan aktif untuk picker HR
 * (mis. Generate Program Onboarding, tanpa batasan scope atasan).
 * Driver-agnostic, read-only.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface DirectoryEmployee {
  employeeId: string;
  employeeCode: string | null;
  fullName: string;
  status: string | null;
  department: string | null;
  position: string | null;
  managerId: string | null;
  managerName: string | null;
}

/**
 * Daftar karyawan (default hanya status AKTIF) untuk dropdown HR.
 */
export async function listEmployeesForHr(
  db: Db,
  options?: { includeInactive?: boolean; limit?: number }
): Promise<DirectoryEmployee[]> {
  const limit = options?.limit ?? 500;
  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.employee_code AS "employeeCode",
           e.full_name AS "fullName", e.status,
           d.department_name AS "department", jp.position_title AS "position",
           e.manager_id AS "managerId", m.full_name AS "managerName"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN job_positions jp ON jp.id = e.position_id
      LEFT JOIN employees m ON m.id = e.manager_id
     WHERE ${options?.includeInactive ? sql`TRUE` : sql`e.status IN ('PROBATION','PERMANENT','CONTRACT')`}
     ORDER BY e.full_name ASC
     LIMIT ${limit}
  `)) as unknown as { rows: Array<Record<string, unknown>> };

  return (res.rows ?? []).map((r) => ({
    employeeId: String(r.employeeId),
    employeeCode: (r.employeeCode as string) ?? null,
    fullName: String(r.fullName),
    status: (r.status as string) ?? null,
    department: (r.department as string) ?? null,
    position: (r.position as string) ?? null,
    managerId: (r.managerId as string) ?? null,
    managerName: (r.managerName as string) ?? null,
  }));
}
