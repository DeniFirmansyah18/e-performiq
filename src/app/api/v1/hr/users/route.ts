import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';

/**
 * Picker penerima disposisi. `letter_dispositions.to_user_id` menunjuk ke
 * `users(id)`, bukan `employees(id)` — karena itu daftar ini memakai users.
 * Kolom kata sandi tidak pernah dipilih.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:manage');

    const res = (await db.execute(sql`
      SELECT u.id, u.email, u.role, e.full_name AS "fullName"
        FROM users u
        LEFT JOIN employees e ON e.id = u.employee_id
       WHERE u.id <> ${session.userId}::uuid
       ORDER BY u.role, u.email
    `)) as unknown as {
      rows: Array<{ id: string; email: string; role: string; fullName: string | null }>;
    };

    return ok({ items: res.rows ?? [] });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat daftar pengguna', status);
  }
}
