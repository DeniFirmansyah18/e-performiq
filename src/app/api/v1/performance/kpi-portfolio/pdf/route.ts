import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { fail, problem } from '@/lib/api/response';
import { getKpiPortfolioPdfData } from '@/lib/services/kpiPortfolioService';
import { buildKpiPortfolioPdf } from '@/lib/services/kpiPortfolioPdfService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/performance/kpi-portfolio/pdf?period_id=<uuid>
 * Mengunduh rekapitulasi portofolio KPI karyawan (self, dari session) sebagai
 * PDF ASLI, bersumber dari `individual_kpis` + `performance_appraisals`.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session.employeeId) {
      return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);
    }
    const periodId = req.nextUrl.searchParams.get('period_id') ?? undefined;

    const data = await getKpiPortfolioPdfData(db, session.employeeId, periodId);
    if (!data) {
      return fail('NOT_FOUND', 'Data karyawan tidak ditemukan.', 404);
    }

    const pdf = await buildKpiPortfolioPdf({
      employeeName: data.employeeName,
      employeeCode: data.employeeCode,
      departmentName: data.departmentName,
      positionTitle: data.positionTitle,
      periodCode: data.periodCode,
      kpiScore: data.kpiScore,
      totalScore: data.totalScore,
      gpa: data.gpa,
      rating: data.rating,
      rows: data.rows,
    });

    const filename = `portofolio-kpi-${data.periodCode || 'periode'}.pdf`;
    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return problem(err, '/api/v1/performance/kpi-portfolio/pdf');
  }
}
