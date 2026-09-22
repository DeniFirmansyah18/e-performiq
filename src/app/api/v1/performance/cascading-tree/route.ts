import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as analyticsService from '@/lib/services/analyticsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/cascading-tree
// PRD §11.2 — Mengambil visualisasi pohon cascading dari BSC Korporasi → Individu
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const perspectiveFilter = searchParams.get('perspective') ?? undefined;

    const cascadingTree = await analyticsService.getCascadingTree(db, perspectiveFilter);
    return ok(cascadingTree);
  } catch (err) {
    return problem(err, '/api/v1/performance/cascading-tree');
  }
}
