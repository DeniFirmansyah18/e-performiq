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

const ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'BOD',
  'HR_MANAGER',
  'PEOPLE_MANAGER',
  'EMPLOYEE',
  'AUDITOR',
];

const UpdateUserSchema = z
  .object({
    role: z.enum(ROLES as [UserRole, ...UserRole[]]).optional(),
    employeeId: z.string().uuid('employeeId harus UUID.').nullish(),
    password: z.string().min(8, 'Kata sandi minimal 8 karakter.').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Tidak ada perubahan yang dikirim.',
  });

async function countActiveSuperAdmins(excludeId: string) {
  const res = (await db.execute(sql`
    SELECT count(*)::int AS n FROM users
     WHERE role = 'SUPER_ADMIN'::user_role_enum
       AND is_active
       AND id <> ${excludeId}::uuid
  `)) as unknown as { rows: Array<{ n: number }> };
  return Number(res.rows[0]?.n ?? 0);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'user:manage');

    const body = await parseBody(req, UpdateUserSchema);

    const current = (await db.execute(sql`
      SELECT id, role, is_active AS "isActive", employee_id AS "employeeId"
        FROM users WHERE id = ${params.id}::uuid LIMIT 1
    `)) as unknown as {
      rows: Array<{ id: string; role: UserRole; isActive: boolean; employeeId: string | null }>;
    };
    const user = current.rows[0];
    if (!user) throw new BusinessRuleError('Akun tidak ditemukan.');

    // Jangan biarkan sistem tanpa SUPER_ADMIN aktif — termasuk menurunkan diri sendiri.
    const losingSuperAdmin =
      user.role === 'SUPER_ADMIN' &&
      user.isActive &&
      ((body.role !== undefined && body.role !== 'SUPER_ADMIN') || body.isActive === false);
    if (losingSuperAdmin && (await countActiveSuperAdmins(user.id)) === 0) {
      throw new BusinessRuleError(
        'Harus ada minimal satu SUPER_ADMIN aktif. Angkat pengganti terlebih dahulu.'
      );
    }

    if (body.employeeId !== undefined && body.employeeId !== user.employeeId) {
      if (body.employeeId) {
        const linked = (await db.execute(sql`
          SELECT id FROM users
           WHERE employee_id = ${body.employeeId}::uuid AND id <> ${user.id}::uuid
           LIMIT 1
        `)) as unknown as { rows: Array<{ id: string }> };
        if (linked.rows.length > 0) {
          throw new BusinessRuleError('Karyawan ini sudah memiliki akun.');
        }
      }
    }

    const nextHash = body.password ? await hashPassword(body.password) : null;

    const updated = (await db.execute(sql`
      UPDATE users SET
        role          = COALESCE(${body.role ?? null}::user_role_enum, role),
        is_active     = COALESCE(${body.isActive ?? null}::boolean, is_active),
        employee_id   = CASE WHEN ${body.employeeId !== undefined}::boolean
                             THEN ${body.employeeId ?? null}::uuid
                             ELSE employee_id END,
        password_hash = COALESCE(${nextHash}::text, password_hash)
      WHERE id = ${user.id}::uuid
      RETURNING id, email, role, is_active AS "isActive", employee_id AS "employeeId"
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    return ok({ user: updated.rows[0] }, 'Akun diperbarui.');
  } catch (err) {
    return failFromError(err, 'Gagal memperbarui akun.');
  }
}
