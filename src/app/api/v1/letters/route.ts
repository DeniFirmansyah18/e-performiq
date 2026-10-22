import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listLetters, registerLetter } from '@/lib/services/letterService';

const BodySchema = z.object({
  agendaNumber: z.string().min(3).max(60),
  direction: z.enum(['INCOMING', 'OUTGOING', 'DIRECTIVE']),
  classification: z.enum(['BIASA', 'TERBATAS', 'RAHASIA']),
  subject: z.string().min(3).max(255),
  sender: z.string().max(200).optional(),
  recipient: z.string().max(200).optional(),
  letterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fileUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:read');
    return ok({ items: await listLetters(db, session.userId) });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat surat', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:manage');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await registerLetter(db, { ...parsed.data, createdBy: session.userId });
    return ok(row, 'Surat terdaftar.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mendaftarkan surat',
      status,
    );
  }
}
