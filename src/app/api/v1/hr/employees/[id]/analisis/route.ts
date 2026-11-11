import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem } from '@/lib/api/response';
import { getDetailPegawai } from '@/lib/services/employeeDetailService';
import { analisisDetailPegawai } from '@/lib/services/employeeDetailAi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/hr/employees/:id/analisis
 * Rekomendasi tindakan HR untuk satu pegawai (kinerja, berkas, langkah lanjut).
 * Memakai aturan akses yang sama dengan halaman detail.
 */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);

    const d = await getDetailPegawai(db, session, ctx.params.id);

    const capaian = d.kpi.length > 0
      ? d.kpi.reduce((s: number, k: any) => s + Number(k.capaian ?? 0), 0) / d.kpi.length
      : null;

    const hasil = await analisisDetailPegawai(
      db,
      {
        profil: {
          fullName: d.profil.fullName,
          employeeCode: d.profil.employeeCode,
          departmentName: d.profil.departmentName,
          positionTitle: d.profil.positionTitle,
          status: d.profil.status,
          masaKerja: d.profil.masaKerja,
          managerName: d.profil.managerName,
          directReportCount: d.profil.directReportCount,
        },
        gpaTerakhir: d.riwayatPenilaian[0]?.gpa ?? null,
        ratingTerakhir: d.riwayatPenilaian[0]?.rating ?? null,
        jumlahKpi: d.kpi.length,
        capaianRataRata: capaian,
        jumlahIndikatorHarian: d.indikatorHarian.length,
        dokumen: d.dokumen ?? [],
        bpjsAda: (d.bpjs?.length ?? 0) > 0,
      },
      session.role
    );

    return ok(hasil);
  } catch (err) {
    return problem(err, '/api/v1/hr/employees/[id]/analisis');
  }
}
