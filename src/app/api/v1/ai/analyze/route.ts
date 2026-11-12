import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { analyzeFeature } from '@/lib/services/aiService';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';

const Body = z.object({
  feature: z.string().min(2).max(64),
  role: z.string().optional(),
  /** Nama menu yang sedang dibuka pengguna, agar analisis menyebut konteksnya. */
  menu: z.string().max(160).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'ai:read');
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('invalid_body', 'Field "feature" wajib diisi', 400);

    // `feature` menentukan konteks data yang dirakit; `menu` hanya memberi tahu
    // model menu mana yang sedang dibuka agar rekomendasinya tepat sasaran.
    // Fitur yang belum punya konteks khusus jatuh ke konteks umum HR.
    const data = await analyzeFeature(
      db,
      parsed.data.feature,
      session.role,
      parsed.data.menu ?? null
    );
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/ai/analyze');
  }
}
