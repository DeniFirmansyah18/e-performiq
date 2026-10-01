import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { logAction } from '@/lib/services/auditService';

/** Field yang boleh diubah karyawan sendiri (allowlist). Field lain diabaikan. */
export const EDITABLE_PROFILE_FIELDS = [
  'phone_number',
  'address',
  'date_of_birth',
  'emergency_contact_name',
  'emergency_contact_phone',
  'photo_url',
  'bio',
] as const;

export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

const SELECT_PROFILE = (db: Db, employeeId: string) => sql`
  SELECT id, employee_code AS "employeeCode", full_name AS "fullName", email,
         phone_number AS "phoneNumber", department_id AS "departmentId", position_id AS "positionId",
         status, base_salary AS "baseSalary", join_date AS "joinDate",
         date_of_birth AS "dateOfBirth", address, emergency_contact_name AS "emergencyContactName",
         emergency_contact_phone AS "emergencyContactPhone", photo_url AS "photoUrl", bio
    FROM employees WHERE id = ${employeeId}::uuid
`;

export async function getMyProfile(db: Db, employeeId: string) {
  const res = (await db.execute(SELECT_PROFILE(db, employeeId))) as unknown as { rows: any[] };
  return res.rows[0] ?? null;
}

/**
 * Memperbarui profil karyawan (hanya field allowlist). Field sensitif (base_salary,
 * position_id, employee_code, dll) diabaikan. Menulis satu baris audit_logs.
 */
export async function updateMyProfile(
  db: Db,
  employeeId: string,
  fields: Record<string, unknown>,
  actorUserId: string
) {
  const before = await getMyProfile(db, employeeId);
  const allowed: Record<string, unknown> = {};
  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) allowed[key] = fields[key];
  }
  if (Object.keys(allowed).length === 0) return before;

  // Bangun SET dinamis dengan parameter aman via sql.raw atas nama kolom allowlist.
  const assignments = Object.entries(allowed).map(([k, v]) => sql`${sql.raw(k)} = ${v}`);
  await db.execute(sql`
    UPDATE employees SET ${sql.join(assignments, sql`, `)} WHERE id = ${employeeId}::uuid
  `);

  const after = await getMyProfile(db, employeeId);
  await logAction(db, {
    userId: actorUserId,
    actionType: 'UPDATE',
    entityName: 'employees',
    recordId: employeeId,
    oldData: before,
    newData: after,
    description: 'Self-service profile update',
  });
  return after;
}
