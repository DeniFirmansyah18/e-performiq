import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/auth/me
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);

    const result = await db.execute(sql`
      SELECT u.id, u.employee_id as "employeeId", u.email, u.role,
             e.full_name as "name", e.employee_code as "employeeCode", e.avatar_url as "avatarUrl",
             d.department_name as "department", jp.position_title as "position"
        FROM users u
        LEFT JOIN employees e ON e.id = u.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN job_positions jp ON jp.id = e.position_id
       WHERE u.id = ${session.userId}::uuid
    `);

    const user = result.rows[0] as any;
    if (!user) {
      return ok({ user: session });
    }

    return ok({
      user: {
        id: user.id,
        employee_id: user.employeeId,
        email: user.email,
        name: user.name ?? 'User',
        role: user.role,
        department: user.department ?? 'Corporate',
        position: user.position ?? user.role,
        avatar_url: user.avatarUrl,
      },
    });
  } catch (err) {
    return problem(err, '/api/v1/auth/me');
  }
}
