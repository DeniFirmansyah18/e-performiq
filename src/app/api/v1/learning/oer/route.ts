import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { TRUSTED_OER_DOMAINS } from '@/lib/services/oerCatalogService';
import { searchOerWithAi } from '@/lib/services/oerSearchAiService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/learning/oer?q=<kata kunci>&positionId=<uuid>&limit=<n>
 * Cari materi gratis (OER) berbantuan AI dengan acuan PLM perusahaan.
 * Bila `positionId` diberikan, judul posisi + skill wajib lowongan dipakai
 * sebagai konteks sehingga rekomendasi sesuai posisi.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
    const positionId = req.nextUrl.searchParams.get('positionId')?.trim() ?? '';
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 6, 1), 12);

    let positionTitle: string | null = null;
    let requiredSkills: string[] = [];
    if (positionId) {
      try {
        const pos = (await db.execute(sql`
          SELECT position_title AS "positionTitle" FROM job_positions WHERE id = ${positionId}::uuid
        `)) as unknown as { rows: Array<{ positionTitle: string }> };
        positionTitle = pos.rows?.[0]?.positionTitle ?? null;
        const sk = (await db.execute(sql`
          SELECT required_skills AS "requiredSkills" FROM job_postings
           WHERE position_id = ${positionId}::uuid ORDER BY posted_at DESC NULLS LAST LIMIT 1
        `)) as unknown as { rows: Array<{ requiredSkills: unknown }> };
        const raw = sk.rows?.[0]?.requiredSkills;
        if (Array.isArray(raw)) requiredSkills = raw.map((x) => (typeof x === 'string' ? x : (x as any)?.name ?? '')).filter(Boolean);
        else if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (Array.isArray(p)) requiredSkills = p.map(String); } catch { /* ignore */ } }
      } catch { /* konteks opsional */ }
    }

    const { results, aiUsed } = await searchOerWithAi({ query: q, positionTitle, requiredSkills, limit });
    return ok({ query: q || null, positionId: positionId || null, aiUsed, results, trustedDomains: TRUSTED_OER_DOMAINS });
  } catch (err) {
    return problem(err, '/api/v1/learning/oer');
  }
}
