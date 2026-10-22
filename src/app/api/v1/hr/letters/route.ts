import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listAllLetters, type LetterStatus } from '@/lib/services/letterService';

const VALID: LetterStatus[] = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'CLOSED'];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'letter:manage');

    const raw = req.nextUrl.searchParams.get('status');
    if (raw && !VALID.includes(raw as LetterStatus)) {
      return fail('VALIDATION_ERROR', `Status '${raw}' tidak dikenal.`, 400);
    }

    const items = await listAllLetters(db, { status: (raw as LetterStatus) ?? undefined });
    return ok({ items, total: items.length });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat register surat', status);
  }
}
