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
  manager_kpi_id: z.string().min(1, 'manager_kpi_id wajib diisi'),
  position_id: z.string().min(1, 'position_id wajib diisi'),
});

/**
 * POST /api/v1/performance/kpi-cascade/position/generate
 *
 * People Manager menyusun usulan KPI POSISI dari KPI manajer, untuk ditugaskan
 * kepada pegawai yang menduduki posisi tersebut.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!PENETAP_TINGKAT.POSISI.includes(session.role)) {
      throw new ForbiddenError('Hanya People Manager atau HR yang dapat menyusun KPI posisi.');
    }

    const data = await parseBody(req, Body);

    const induk = (await db.execute(sql`
      SELECT kpi_title AS judul, target_value::float8 AS target,
             unit_of_measure AS satuan
        FROM manager_kpis WHERE id = ${data.manager_kpi_id}::uuid
    `)) as unknown as { rows: Array<{ judul: string; target: number; satuan: string }> };
    if (!induk.rows?.length) throw new Error('KPI manajer induk tidak ditemukan.');

    const pos = (await db.execute(sql`
      SELECT position_title AS nama FROM job_positions WHERE id = ${data.position_id}::uuid
    `)) as unknown as { rows: Array<{ nama: string }> };
    if (!pos.rows?.length) throw new Error('Posisi tidak ditemukan.');

    const vm = (await db.execute(sql`
      SELECT vision, mission FROM company_vision_mission ORDER BY updated_at DESC LIMIT 1
    `)) as unknown as { rows: Array<{ vision: string; mission: string }> };

    const hasil = await usulkanKpiTurunan({
      tingkat: 'POSISI',
      indukJudul: induk.rows[0].judul,
      indukTarget: Number(induk.rows[0].target),
      indukSatuan: induk.rows[0].satuan ?? '%',
      pemilik: pos.rows[0].nama,
      visi: vm.rows?.[0]?.vision ?? '',
      misi: vm.rows?.[0]?.mission ?? '',
    });

    return ok(
      {
        ...hasil,
        induk: { id: data.manager_kpi_id, judul: induk.rows[0].judul },
        pemilik: { id: data.position_id, nama: pos.rows[0].nama },
      },
      hasil.sumber === 'AI'
        ? 'Usulan KPI posisi disusun oleh AI.'
        : 'Usulan KPI posisi disusun dari KPI induk (AI tidak tersedia).'
    );
  } catch (err) {
    return failFromError(err, 'Gagal menyusun usulan KPI posisi.');
  }
}
