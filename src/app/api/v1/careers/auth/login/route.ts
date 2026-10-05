import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { signCandidateSession, CANDIDATE_COOKIE_NAME } from '@/lib/auth/candidateSession';
import { ok, fail, problem, parseBody } from '@/lib/api/response';
import { AuthError } from '@/lib/auth/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

// POST /api/v1/careers/auth/login — login kandidat (terpisah dari login karyawan)
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await parseBody(req, LoginSchema);

    const result = await db.execute(sql`
      SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName",
             is_active AS "isActive"
        FROM candidate_accounts
       WHERE LOWER(email) = LOWER(${email})
    `);
    const acc = (result as any).rows[0];
    if (acc && !acc.isActive) {
      // Sesi valid tetapi akun nonaktif → kemungkinan sudah dikonversi jadi karyawan.
      return fail(
        'ACCOUNT_CONVERTED',
        'Anda telah menjadi karyawan. Silakan login di portal karyawan (/login).',
        403,
      );
    }
    if (!acc) {
      throw new AuthError('Email atau kata sandi tidak valid.');
    }
    const valid = await verifyPassword(password, acc.passwordHash);
    if (!valid) throw new AuthError('Email atau kata sandi tidak valid.');

    // kandidat terkait (bila sudah pernah melamar)
    const cand = await db.execute(sql`
      SELECT id FROM candidates WHERE account_id = ${acc.id}::uuid LIMIT 1
    `);
    const candidateId = (cand as any).rows[0]?.id ?? null;

    await db.execute(sql`
      UPDATE candidate_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ${acc.id}::uuid
    `);

    const token = await signCandidateSession({
      accountId: acc.id,
      candidateId,
      email: acc.email,
      name: acc.fullName,
    });

    const response = ok({
      access_token: token,
      token_type: 'Bearer',
      account: { id: acc.id, email: acc.email, name: acc.fullName, candidateId },
    });
    response.cookies.set({
      name: CANDIDATE_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2592000, // 30 hari — sesi tahan lama hingga logout eksplisit
      path: '/',
    });
    return response;
  } catch (err) {
    return problem(err, '/api/v1/careers/auth/login');
  }
}
