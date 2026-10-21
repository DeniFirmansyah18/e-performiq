import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export type EmploymentStatus =
  | 'PROBATION' | 'PKWT' | 'PKWTT' | 'TETAP' | 'RESIGNED' | 'RETIRED';

export interface EmploymentStatusRow {
  employeeId: string;
  fullName: string;
  status: EmploymentStatus;
  joinDate: string;
  appointmentDate: string | null;
  history?: Array<{
    previousStatus: EmploymentStatus | null;
    newStatus: EmploymentStatus;
    effectiveDate: string;
    reason: string | null;
  }>;
}

export async function getEmploymentStatus(db: Db, employeeId: string): Promise<EmploymentStatusRow | null> {
  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.full_name AS "fullName",
           e.employment_status AS status, e.join_date AS "joinDate",
           e.appointment_date AS "appointmentDate"
      FROM employees e WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: EmploymentStatusRow[] };
  const row = res.rows?.[0];
  if (!row) return null;

  const hist = (await db.execute(sql`
    SELECT previous_status AS "previousStatus", new_status AS "newStatus",
           effective_date AS "effectiveDate", reason
      FROM employment_status_history
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY effective_date DESC, created_at DESC
  `)) as unknown as { rows: NonNullable<EmploymentStatusRow['history']> };

  return { ...row, history: hist.rows ?? [] };
}

export async function changeEmploymentStatus(
  db: Db,
  input: {
    employeeId: string;
    newStatus: EmploymentStatus;
    effectiveDate: string;
    reason: string;
    decidedBy: string;
  },
): Promise<EmploymentStatusRow> {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan perubahan status wajib diisi (minimal 5 karakter).');
  }

  const before = await getEmploymentStatus(db, input.employeeId);
  if (!before) throw new BusinessRuleError('Karyawan tidak ditemukan.');
  if (before.status === input.newStatus) {
    throw new BusinessRuleError(`Status sudah ${input.newStatus}; tidak ada perubahan untuk dicatat.`);
  }

  await db.execute(sql`
    WITH prev AS (
      SELECT employment_status FROM employees WHERE id = ${input.employeeId}::uuid
    ), upd AS (
      UPDATE employees
         SET employment_status = ${input.newStatus}::employment_status_enum,
             appointment_date = CASE
               WHEN ${input.newStatus} = 'TETAP' THEN ${input.effectiveDate}::date
               ELSE appointment_date END
       WHERE id = ${input.employeeId}::uuid
      RETURNING id
    )
    INSERT INTO employment_status_history
      (employee_id, previous_status, new_status, effective_date, reason, decided_by)
    SELECT ${input.employeeId}::uuid, prev.employment_status,
           ${input.newStatus}::employment_status_enum, ${input.effectiveDate}::date,
           ${input.reason}, ${input.decidedBy}::uuid
      FROM prev
  `);

  const after = await getEmploymentStatus(db, input.employeeId);
  if (!after) throw new BusinessRuleError('Status gagal dibaca setelah perubahan.');
  return after;
}

export async function listByStatus(db: Db, status?: EmploymentStatus): Promise<EmploymentStatusRow[]> {
  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.full_name AS "fullName",
           e.employment_status AS status, e.join_date AS "joinDate",
           e.appointment_date AS "appointmentDate"
      FROM employees e
     WHERE (${status ?? null}::employment_status_enum IS NULL
            OR e.employment_status = ${status ?? null}::employment_status_enum)
     ORDER BY e.full_name
  `)) as unknown as { rows: EmploymentStatusRow[] };
  return res.rows ?? [];
}
