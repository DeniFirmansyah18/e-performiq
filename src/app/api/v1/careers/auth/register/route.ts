import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { signCandidateSession, CANDIDATE_COOKIE_NAME } from '@/lib/auth/candidateSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import { BusinessRuleError } from '@/lib/auth/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap wajib diisi'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  phone: z.string().optional(),
});

// POST /api/v1/careers/auth/register — pendaftaran akun kandidat mandiri
export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password, phone } = await parseBody(req, RegisterSchema);
    const normalizedEmail = email.toLowerCase();

    const existing = await db.execute(sql`
      SELECT id FROM candidate_accounts WHERE LOWER(email) = ${normalizedEmail} LIMIT 1
    `);
    if ((existing as any).rows[0]) {
      throw new BusinessRuleError('Email sudah terdaftar. Silakan login atau gunakan email lain.');
    }

    const hash = await hashPassword(password);
    const inserted = await db.execute(sql`
      INSERT INTO candidate_accounts (email, password_hash, full_name, phone, is_verified)
      VALUES (${normalizedEmail}, ${hash}, ${fullName}, ${phone ?? null}, FALSE)
      RETURNING id, email, full_name AS "fullName"
    `);
    const acc = (inserted as any).rows[0];

    const token = await signCandidateSession({
      accountId: acc.id,
      candidateId: null,
      email: acc.email,
      name: acc.fullName,
    });

    const response = ok({
      access_token: token,
      token_type: 'Bearer',
      account: { id: acc.id, email: acc.email, name: acc.fullName, candidateId: null },
    });
    response.cookies.set({
      name: CANDIDATE_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 43200, // 12 jam
      path: '/',
    });
    return response;
  } catch (err) {
    return problem(err, '/api/v1/careers/auth/register');
  }
}
