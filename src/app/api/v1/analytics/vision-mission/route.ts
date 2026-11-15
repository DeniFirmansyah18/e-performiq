import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, failFromError } from '@/lib/api/response';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  vision: z.string().min(3, 'Visi minimal 3 karakter.').max(1000, 'Visi maksimal 1000 karakter.'),
  mission: z.string().min(3, 'Misi minimal 3 karakter.').max(3000, 'Misi maksimal 3000 karakter.'),
});

/**
 * POST /api/v1/analytics/vision-mission
 *
 * Diisi oleh BOD: menetapkan / mengubah Visi & Misi perusahaan. Upsert ke
 * baris terbaru `company_vision_mission`. Bila belum ada baris, dibuat baru.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:manage');

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid.', 400);
    }
    const { vision, mission } = parsed.data;

    const res = await db.execute(sql`
      INSERT INTO company_vision_mission (vision, mission)
      VALUES (${vision}, ${mission})
      RETURNING id::text, vision, mission, updated_at::text
    `);

    const saved = (res as any).rows?.[0];
    return ok(saved, 'Visi & Misi perusahaan berhasil disimpan.');
  } catch (err) {
    return failFromError(err, 'Gagal menyimpan visi & misi');
  }
}
