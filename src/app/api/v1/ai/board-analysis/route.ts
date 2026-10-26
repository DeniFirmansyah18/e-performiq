import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
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

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'ai:read');

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Body tidak valid.', 400);
    }

    const periodCode = parsed.data.periodCode ?? 'ALL';
    const force = parsed.data.force === true;
    const key = { feature: 'board', periodCode, role: session.role };

    const existing = await getCachedInsight(db, key);

    // Tanpa force: sajikan cache agar rapat BOD tidak memicu panggilan berulang.
    if (!force && existing) {
      return ok({
        insight: existing.insight,
        provider: existing.provider,
        generatedAt: existing.generatedAt,
        fromCache: true,
        configured: true,
        failed: false,
      });
    }

    const context = await buildFeatureContext(db, 'board');
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
      });
    }

    const provider = activeProvider();
    await saveInsight(db, {
      ...key,
      insight,
      provider,
      payloadHash: hashPayload(context),
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
    });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menjalankan analisis AI',
      status
    );
  }
}
