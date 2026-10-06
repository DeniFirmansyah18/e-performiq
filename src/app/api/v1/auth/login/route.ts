import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { ok, problem, parseBody } from '@/lib/api/response';
import { AuthError } from '@/lib/auth/errors';
import { logAction } from '@/lib/services/auditService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

// POST /api/v1/auth/login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await parseBody(req, LoginSchema);

    const result = await db.execute(sql`
      SELECT u.id, u.employee_id as "employeeId", u.email, u.password_hash as "passwordHash",
             u.role, u.is_active as "isActive",
             e.full_name as "name", e.employee_code as "employeeCode", e.avatar_url as "avatarUrl",
             e.status as "status", e.join_date as "joinDate",
             d.department_name as "department", jp.position_title as "position"
        FROM users u
        LEFT JOIN employees e ON e.id = u.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN job_positions jp ON jp.id = e.position_id
       WHERE LOWER(u.email) = LOWER(${email})
    `);

    const user = result.rows[0] as any;
    if (!user) {
      throw new AuthError('Email atau kata sandi tidak valid. Silakan periksa kembali.');
    }

    if (!user.isActive) {
      throw new AuthError('Akun pengguna telah dinonaktifkan. Hubungi administrator.');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AuthError('Email atau kata sandi tidak valid. Silakan periksa kembali.');
    }

    const token = await signSession({
      userId: user.id,
      employeeId: user.employeeId,
      role: user.role,
      email: user.email,
    });

    // Update last_login_at
    await db.execute(sql`
      UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ${user.id}::uuid
    `);

    // Log audit login
    await logAction(db, {
      userId: user.id,
      actionType: 'LOGIN',
      entityName: 'users',
      recordId: user.id,
      description: `User login berhasil via enterprise auth: ${user.email} (${user.role})`,
      ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'E-PerformIQ Client',
    });

    const response = ok({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 2592000,
      user: {
        id: user.id,
        employee_id: user.employeeId,
        email: user.email,
        name: user.name ?? 'Administrator',
        role: user.role,
        department: user.department ?? 'Corporate',
        position: user.position ?? user.role,
        avatar_url: user.avatarUrl,
        status: user.status ?? null,
        join_date: user.joinDate ? new Date(user.joinDate).toISOString() : null,
      },
    });

    // Set HttpOnly cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2592000, // 30 days — sesi tahan lama hingga logout eksplisit
      path: '/',
    });

    return response;
  } catch (err) {
    return problem(err, '/api/v1/auth/login');
  }
}
