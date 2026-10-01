import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { analyzeFeature } from '@/lib/services/aiService';
import { getDb } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';

const Body = z.object({
  feature: z.string().min(2).max(64),
  role: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'ai:read');
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('invalid_body', 'Field "feature" wajib diisi', 400);
    const data = await analyzeFeature(getDb(), parsed.data.feature, session.role);
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/ai/analyze');
  }
}
