import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/executive/ai/search?q=Tono
 *
 * Pencarian pegawai by nama untuk asisten BOD. Kembalikan daftar singkat;
 * detail + rekomendasi AI dipanggil lewat analisis-per-id yang sudah ada.
 * Kata kunci diparameterisasi (ILIKE '%' || param || '%') agar aman.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'ai:read');
    assertCan(session, 'analytics:manage');

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return ok({ items: [], total: 0, pedoman: 'Minimal 2 karakter.' });
    }

    const res = (await db.execute(sql`
      SELECT
        e.id::text AS id,
        e.employee_code AS "kode",
        e.full_name AS "nama",
        d.department_name AS "departemen",
        p.position_title AS "posisi",
        e.status::text AS "status"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN job_positions p ON p.id = e.position_id
      WHERE e.full_name ILIKE '%' || ${q} || '%'
        AND e.status IN ('PROBATION','PERMANENT','CONTRACT')
      ORDER BY e.full_name
      LIMIT 15
    `)) as unknown as { rows: any[] };

    return ok({
      items: (res.rows ?? []).map((r) => ({
        id: r.id,
        kode: r.kode ?? null,
        nama: r.nama ?? null,
        departemen: r.departemen ?? null,
        posisi: r.posisi ?? null,
        status: r.status ?? null,
      })),
      total: (res.rows ?? []).length,
    });
  } catch (err) {
    return problem(err, '/api/v1/executive/ai/search');
  }
}
