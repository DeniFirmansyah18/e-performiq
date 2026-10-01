import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { isAiConfigured } from '@/lib/services/aiService';
import { ok, problem } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'ai:read');
    return ok({ configured: isAiConfigured() });
  } catch (err) {
    return problem(err, '/api/v1/ai/status');
  }
}
