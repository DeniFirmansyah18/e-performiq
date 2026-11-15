import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { analyzeWithContext } from '@/lib/services/aiService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/v1/executive/ai/mpp
 *
 * Menjawab pertanyaan BOD tentang Manpower Planning: kapan merekrut, posisi
 * apa yang paling perlu, sisa kuota per departemen. ANGKA dihitung di sini
 * dari DB; model hanya memberi narasi + rekomendasi (null bila AI tak ada).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'ai:read');
    assertCan(session, 'analytics:manage');

    const res = (await db.execute(`
      SELECT
        d.department_name AS "departemen",
        mp.fiscal_year AS "tahun",
        p.position_title AS "posisi",
        mp.approved_quota AS "kuota",
        mp.hired_count AS "terisi",
        (mp.approved_quota - mp.hired_count) AS "sisaKuota",
        mp.allocated_budget AS "anggaran",
        mp.utilized_budget AS "anggaranTerpakai",
        (mp.allocated_budget - mp.utilized_budget) AS "sisaAnggaran"
      FROM manpower_plans mp
      JOIN departments d ON d.id = mp.department_id
      JOIN job_positions p ON p.id = mp.position_id
      WHERE mp.approved_quota > 0
      ORDER BY (mp.approved_quota - mp.hired_count) DESC, d.department_name
    `)) as unknown as { rows: any[] };

    const baris = res.rows ?? [];
    const totalKuota = baris.reduce((s, r) => s + Number(r.kuota ?? 0), 0);
    const totalTerisi = baris.reduce((s, r) => s + Number(r.terisi ?? 0), 0);
    const totalSisa = totalKuota - totalTerisi;
    const posisiPrioritas = [...baris]
      .filter((r) => Number(r.sisaKuota) > 0)
      .sort((a, b) => Number(b.sisaKuota) - Number(a.sisaKuota))
      .slice(0, 5);

    const ringkas = {
      jumlahTotalFormasi: totalKuota,
      jumlahTerisi: totalTerisi,
      jumlahSisaLowongan: Math.max(0, totalSisa),
      jumlahDepartemenDenganLowongan: new Set(baris.filter((r) => Number(r.sisaKuota) > 0).map((r) => r.departemen)).size,
      posisiTerbukaPalingBanyak: posisiPrioritas.map((r) => ({
        departemen: r.departemen,
        posisi: r.posisi,
        sisa: Number(r.sisaKuota),
        sisaAnggaran: Number(r.sisaAnggaran ?? 0),
      })),
      perluSegeraRekrut: baris.filter((r) => Number(r.sisaKuota) > 0 && Number(r.sisaKuota) >= 2).length,
    };

    const { insight, configured, failed } = await analyzeWithContext(
      {
        ...ringkas,
        instruksi:
          'Rekomendasikan prioritas rekrutmen: posisi mana yang harus diisi segera, ' +
          'departemen mana, dan berapa orang, dengan mempertimbangkan sisa kuota dan anggaran.',
      },
      'mpp-rekrutmen',
      session.role
    );

    return ok({
      angka: ringkas,
      rincian: posisiPrioritas,
      rekomendasi: configured && !failed ? insight : null,
      providerReady: configured,
      failed,
    });
  } catch (err) {
    return problem(err, '/api/v1/executive/ai/mpp');
  }
}
