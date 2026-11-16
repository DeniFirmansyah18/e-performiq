import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import { ForbiddenError } from '@/lib/auth/errors';
import { PENETAP_TINGKAT } from '@/lib/services/kpiCascade';
import { usulkanKpiTurunan } from '@/lib/services/kpiCascadeAiService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  division_kpi_id: z.string().min(1, 'division_kpi_id wajib diisi'),
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
});

/**
 * POST /api/v1/performance/kpi-cascade/manager/generate
 *
 * HR (atau People Manager) menyusun usulan KPI MANAJER dari KPI divisi,
 * untuk ditugaskan kepada People Manager departemen terkait.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!PENETAP_TINGKAT.MANAJER.includes(session.role)) {
      throw new ForbiddenError('Hanya HR atau People Manager yang dapat menyusun KPI manajer.');
    }

    const data = await parseBody(req, Body);

    const induk = (await db.execute(sql`
      SELECT kpi_title AS judul, target_value::float8 AS target,
             d.department_name AS dept
        FROM division_kpis dk
        JOIN departments d ON d.id = dk.department_id
       WHERE dk.id = ${data.division_kpi_id}::uuid
    `)) as unknown as { rows: Array<{ judul: string; target: number; dept: string }> };
    if (!induk.rows?.length) throw new Error('KPI divisi induk tidak ditemukan.');

    const pm = (await db.execute(sql`
      SELECT full_name AS nama FROM employees WHERE id = ${data.employee_id}::uuid
    `)) as unknown as { rows: Array<{ nama: string }> };
    if (!pm.rows?.length) throw new Error('People Manager tidak ditemukan.');

    const vm = (await db.execute(sql`
      SELECT vision, mission FROM company_vision_mission ORDER BY updated_at DESC LIMIT 1
    `)) as unknown as { rows: Array<{ vision: string; mission: string }> };

    const hasil = await usulkanKpiTurunan({
      tingkat: 'MANAJER',
      indukJudul: induk.rows[0].judul,
      indukTarget: Number(induk.rows[0].target),
      indukSatuan: '%',
      pemilik: `${pm.rows[0].nama} (${induk.rows[0].dept})`,
      visi: vm.rows?.[0]?.vision ?? '',
      misi: vm.rows?.[0]?.mission ?? '',
    });

    return ok(
      {
        ...hasil,
        induk: { id: data.division_kpi_id, judul: induk.rows[0].judul },
        pemilik: { id: data.employee_id, nama: pm.rows[0].nama, departemen: induk.rows[0].dept },
      },
      hasil.sumber === 'AI'
        ? 'Usulan KPI manajer disusun oleh AI.'
        : 'Usulan KPI manajer disusun dari KPI induk (AI tidak tersedia).'
    );
  } catch (err) {
    return failFromError(err, 'Gagal menyusun usulan KPI manajer.');
  }
}
