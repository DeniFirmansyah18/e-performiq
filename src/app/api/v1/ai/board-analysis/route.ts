import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, failFromError } from '@/lib/api/response';
import { rateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rateLimit';
import { db } from '@/lib/db/client';
import { buildFeatureContext } from '@/lib/services/aiContext';
import { analyzeWithContext, activeProvider } from '@/lib/services/aiService';
import {
  getCachedInsight,
  saveInsight,
  hashPayload,
} from '@/lib/services/aiInsightCacheService';
import { logAction } from '@/lib/services/auditService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  periodCode: z.string().min(1).max(50).optional(),
  force: z.boolean().optional(),
});

/** Panggilan LLM berbiaya (dan `force` melewati cache): 20 per menit per pengguna. */
const BOARD_AI_LIMIT = 20;
const BOARD_AI_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'ai:read');

        const limited = rateLimit(rateLimitKey(req, session.userId), BOARD_AI_LIMIT, BOARD_AI_WINDOW_MS);
        if (!limited.allowed) {
          const res = fail(
            'RATE_LIMITED',
            `Terlalu banyak permintaan analisis. Coba lagi dalam ${limited.retryAfterSeconds} detik.`,
            429
          );
          for (const [k, v] of Object.entries(rateLimitHeaders(limited, BOARD_AI_LIMIT))) {
            res.headers.set(k, v);
          }
          return res;
        }

        const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Body tidak valid.', 400);
    }

    const periodCode = parsed.data.periodCode ?? 'ALL';
    const force = parsed.data.force === true;
    const key = { feature: 'board', periodCode, role: session.role };

        // Konteks dirakit lebih dulu agar `payload_hash` benar-benar dipakai
        // (spec §4.1): cache hanya disajikan bila datanya masih sama.
        const context = await buildFeatureContext(db, 'board');
        const payloadHash = hashPayload(context);

        const existing = await getCachedInsight(db, key);
        const cacheIsFresh = !!existing && existing.payloadHash === payloadHash;

        // Tanpa force: sajikan cache agar rapat BOD tidak memicu panggilan berulang.
        if (!force && cacheIsFresh) {
          return ok({
            insight: existing!.insight,
            provider: existing!.provider,
            generatedAt: existing!.generatedAt,
            fromCache: true,
            configured: true,
            failed: false,
            staleCacheDiscarded: false,
          });
        }

        const staleCacheDiscarded = !!existing && !cacheIsFresh;

        const { insight, configured, failed } = await analyzeWithContext(
          context,
          'board',
          session.role
        );

        if (!configured) {
          // Tanpa kunci provider bukan kegagalan server: beri pesan ramah.
          return ok({
            insight,
            provider: null,
            generatedAt: null,
            fromCache: false,
            configured: false,
            failed: false,
            staleCacheDiscarded,
          });
        }

        if (failed) {
          // Provider gagal sementara (rate limit/5xx/network). Jangan simpan: satu
          // 429 saat rapat BOD tidak boleh menjadi narasi permanen di cache.
          return ok({
            insight:
              'Analisis AI sedang tidak tersedia karena penyedia layanan menolak permintaan. ' +
              'Angka pada tab lain tetap menjadi sumber kebenaran; silakan coba lagi.',
            provider: null,
            generatedAt: null,
            fromCache: false,
            configured: true,
            failed: true,
            staleCacheDiscarded,
          });
        }

        const provider = activeProvider();
        await saveInsight(db, {
          ...key,
          insight,
          provider,
          payloadHash,
        });

    // action_type dibatasi CHECK constraint audit_logs: CREATE/UPDATE saja.
    await logAction(db, {
      userId: session.userId,
      actionType: existing ? 'UPDATE' : 'CREATE',
      entityName: 'ai_insights',
      recordId: `${key.feature}:${key.periodCode}:${key.role}`,
      description: `Analisis AI ${key.feature} periode ${key.periodCode}`,
    });

    return ok({
      insight,
      provider,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      configured: true,
      failed: false,
          staleCacheDiscarded,
        });
  } catch (err: any) {
      return failFromError(err, 'Gagal menjalankan analisis AI');
    }
}
