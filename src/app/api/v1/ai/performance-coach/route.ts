import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { rateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rateLimit';
import { db } from '@/lib/db/client';
import { answerPerformanceQuestion } from '@/lib/services/aiCoachService';

const BodySchema = z.object({ question: z.string().min(5).max(1000) });

/** Panggilan LLM berbiaya: 20 per menit per pengguna. */
const COACH_LIMIT = 20;
const COACH_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'ai:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const limited = rateLimit(rateLimitKey(req, session.userId), COACH_LIMIT, COACH_WINDOW_MS);
    if (!limited.allowed) {
      const res = fail(
        'RATE_LIMITED',
        `Terlalu banyak pertanyaan. Coba lagi dalam ${limited.retryAfterSeconds} detik.`,
        429,
      );
      for (const [k, v] of Object.entries(rateLimitHeaders(limited, COACH_LIMIT))) {
        res.headers.set(k, v);
      }
      return res;
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Pertanyaan tidak valid', 400);
    }

    const result = await answerPerformanceQuestion(db, {
      employeeId: session.employeeId,
      question: parsed.data.question,
      role: session.role,
    });
    return ok(result);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menjawab pertanyaan', status);
  }
}
