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
  corporate_kpi_id: z.string().min(1, 'corporate_kpi_id wajib diisi'),
  department_id: z.string().min(1, 'department_id wajib diisi'),
});

/**
 * POST /api/v1/performance/kpi-cascade/division/generate
 *
 * HR menyusun usulan KPI DIVISI dari KPI korporat yang sudah disetujui BOD.
 * Hasilnya usulan saja (belum disimpan); HR meninjau lalu menyimpan per item
 * lewat POST /kpi-cascade/division.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!PENETAP_TINGKAT.DEPARTEMEN.includes(session.role)) {
      throw new ForbiddenError('Hanya HR yang dapat menyusun KPI divisi dari KPI direktur.');
    }

    const data = await parseBody(req, Body);

    const induk = (await db.execute(sql`
      SELECT kpi_name AS judul, target_value::float8 AS target,
             unit_of_measure AS satuan
        FROM corporate_kpis WHERE id = ${data.corporate_kpi_id}::uuid
    `)) as unknown as { rows: Array<{ judul: string; target: number; satuan: string }> };
    if (!induk.rows?.length) throw new Error('KPI korporat induk tidak ditemukan.');

    const dept = (await db.execute(sql`
      SELECT department_name AS nama FROM departments WHERE id = ${data.department_id}::uuid
    `)) as unknown as { rows: Array<{ nama: string }> };
    if (!dept.rows?.length) throw new Error('Departemen tidak ditemukan.');

    const vm = (await db.execute(sql`
      SELECT vision, mission FROM company_vision_mission ORDER BY updated_at DESC LIMIT 1
    `)) as unknown as { rows: Array<{ vision: string; mission: string }> };

    const hasil = await usulkanKpiTurunan({
      tingkat: 'DEPARTEMEN',
      indukJudul: induk.rows[0].judul,
      indukTarget: Number(induk.rows[0].target),
      indukSatuan: induk.rows[0].satuan ?? '%',
      pemilik: dept.rows[0].nama,
      visi: vm.rows?.[0]?.vision ?? '',
      misi: vm.rows?.[0]?.mission ?? '',
    });

    return ok(
      {
        ...hasil,
        induk: { id: data.corporate_kpi_id, judul: induk.rows[0].judul },
        pemilik: { id: data.department_id, nama: dept.rows[0].nama },
      },
      hasil.sumber === 'AI'
        ? 'Usulan KPI divisi disusun oleh AI.'
        : 'Usulan KPI divisi disusun dari KPI induk (AI tidak tersedia).'
    );
  } catch (err) {
    return failFromError(err, 'Gagal menyusun usulan KPI divisi.');
  }
}
