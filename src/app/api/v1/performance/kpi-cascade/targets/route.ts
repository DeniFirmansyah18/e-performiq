import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError } from '@/lib/api/response';
import { ForbiddenError } from '@/lib/auth/errors';
import { PENETAP_TINGKAT, type TingkatKpi } from '@/lib/services/kpiCascade';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/performance/kpi-cascade/targets?tingkat=DEPARTEMEN|MANAJER|POSISI
 *
 * Pilihan "pemilik" KPI pada tiap tingkat rantai BOD -> HR -> PM -> Pegawai:
 *   DEPARTEMEN : daftar departemen (tujuan HR membagi KPI direktur)
 *   MANAJER    : daftar People Manager (tujuan HR menugaskan KPI divisi)
 *   POSISI     : daftar posisi jabatan (tujuan PM menugaskan KPI ke pegawai)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const tingkat = (req.nextUrl.searchParams.get('tingkat') ?? '').toUpperCase() as TingkatKpi;

    if (!['DEPARTEMEN', 'MANAJER', 'POSISI'].includes(tingkat)) {
      throw new ForbiddenError('Tingkat tidak dikenal. Gunakan DEPARTEMEN, MANAJER, atau POSISI.');
    }
    if (!PENETAP_TINGKAT[tingkat].includes(session.role)) {
      throw new ForbiddenError('Peran Anda tidak berwenang menetapkan KPI pada tingkat ini.');
    }

    if (tingkat === 'DEPARTEMEN') {
      const res = (await db.execute(sql`
        SELECT id::text AS id, department_name AS "nama"
          FROM departments ORDER BY department_name ASC
      `)) as unknown as { rows: Array<{ id: string; nama: string }> };
      return ok({ items: res.rows ?? [], total: (res.rows ?? []).length });
    }

    if (tingkat === 'MANAJER') {
      const res = (await db.execute(sql`
        SELECT e.id::text AS id, e.full_name AS "nama",
               e.employee_code AS "kode", d.department_name AS "departemen"
          FROM employees e
          JOIN users u ON u.employee_id = e.id
          LEFT JOIN departments d ON d.id = e.department_id
         WHERE u.role = 'PEOPLE_MANAGER'
           AND e.status IN ('PROBATION','PERMANENT','CONTRACT')
         ORDER BY e.full_name ASC
      `)) as unknown as { rows: Array<{ id: string; nama: string; kode: string; departemen: string }> };
      return ok({ items: res.rows ?? [], total: (res.rows ?? []).length });
    }

    const res = (await db.execute(sql`
      SELECT p.id::text AS id, p.position_title AS "nama",
             d.department_name AS "departemen"
        FROM job_positions p
        LEFT JOIN departments d ON d.id = p.department_id
       ORDER BY d.department_name ASC, p.position_title ASC
    `)) as unknown as { rows: Array<{ id: string; nama: string; departemen: string }> };
    return ok({ items: res.rows ?? [], total: (res.rows ?? []).length });
  } catch (err) {
    return failFromError(err, 'Gagal memuat pilihan pemilik KPI.');
  }
}
