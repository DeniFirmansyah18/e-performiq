import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { chat } from '@/lib/services/aiService';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'model']).default('user'),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'ai:read');
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('invalid_body', 'Messages tidak boleh kosong', 400);
    const data = await chat(db, parsed.data.messages, session.role);
    return ok(data);
  } catch (err) {
    return problem(err, '/api/v1/ai/chat');
  }
}
