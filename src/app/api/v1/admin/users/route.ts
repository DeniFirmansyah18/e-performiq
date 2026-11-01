import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { hashPassword } from '@/lib/auth/password';
import { BusinessRuleError } from '@/lib/auth/errors';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import type { UserRole } from '@/types';

/**
 * Manajemen akun (khusus SUPER_ADMIN).
 *
 * `users.id` dipakai `letter_dispositions.to_user_id`, jadi akun tidak pernah
 * dihapus — hanya dinonaktifkan (`is_active = false`) agar riwayat disposisi
 * tetap utuh dan bisa diaudit.
 */

const ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'BOD',
  'HR_MANAGER',
  'PEOPLE_MANAGER',
  'EMPLOYEE',
  'AUDITOR',
];

const CreateUserSchema = z.object({
  email: z.string().trim().email('Format email tidak valid.'),
  role: z.enum(ROLES as [UserRole, ...UserRole[]]),
  employeeId: z.string().uuid('employeeId harus UUID.').nullish(),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'user:read');

    const res = (await db.execute(sql`
      SELECT u.id,
             u.email,
             u.role,
             u.is_active        AS "isActive",
             u.last_login_at    AS "lastLoginAt",
             u.created_at       AS "createdAt",
             u.employee_id      AS "employeeId",
             e.full_name        AS "employeeName",
             e.employee_code    AS "employeeCode",
             d.department_name  AS "departmentName"
        FROM users u
        LEFT JOIN employees e   ON e.id = u.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
       ORDER BY u.is_active DESC, u.role, u.email
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    return ok({ items: res.rows ?? [], roles: ROLES });
  } catch (err) {
    return failFromError(err, 'Gagal memuat daftar akun.');
  }
}

/** Satu karyawan hanya boleh punya satu akun. */
async function assertEmployeeLinkable(employeeId: string | null) {
  if (!employeeId) return;

  const emp = (await db.execute(sql`
    SELECT id FROM employees WHERE id = ${employeeId}::uuid LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (emp.rows.length === 0) {
    throw new BusinessRuleError('Karyawan yang ditautkan tidak ditemukan.');
  }

  const linked = (await db.execute(sql`
    SELECT id FROM users WHERE employee_id = ${employeeId}::uuid LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (linked.rows.length > 0) {
    throw new BusinessRuleError('Karyawan ini sudah memiliki akun.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'user:manage');

    const body = await parseBody(req, CreateUserSchema);
    const email = body.email.toLowerCase();

    const existing = (await db.execute(sql`
      SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1
    `)) as unknown as { rows: Array<{ id: string }> };
    if (existing.rows.length > 0) {
      throw new BusinessRuleError('Email sudah dipakai akun lain.');
    }

    await assertEmployeeLinkable(body.employeeId ?? null);

    const hash = await hashPassword(body.password);
    const inserted = (await db.execute(sql`
      INSERT INTO users (email, password_hash, role, employee_id, is_active)
      VALUES (${email}, ${hash}, ${body.role}::user_role_enum,
              ${body.employeeId ?? null}::uuid, ${body.isActive ?? true})
      RETURNING id, email, role, is_active AS "isActive", employee_id AS "employeeId"
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    return ok({ user: inserted.rows[0] }, 'Akun berhasil dibuat.');
  } catch (err) {
    return failFromError(err, 'Gagal membuat akun.');
  }
}
