import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { fail, problem } from '@/lib/api/response';
import { verifyCertificate } from '@/lib/services/certificateService';
import { buildCertificatePdf } from '@/lib/services/certificatePdfService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/certificates/verify/:code/pdf  (PUBLIK)
 * Mengunduh PDF ASLI sertifikat (bukti penyelesaian onboarding/kursus).
 * Bila kode tidak valid → 404 JSON (bukan PDF kosong).
 */
export async function GET(req: NextRequest, ctx: { params: { code: string } }) {
  try {
    const result = await verifyCertificate(db, ctx.params.code);
    if (!result.valid || !result.certificate) {
      return fail('NOT_FOUND', 'Sertifikat tidak ditemukan.', 404);
    }
    const c = result.certificate;
    const origin = req.nextUrl.origin;
    const pdf = await buildCertificatePdf({
      employeeName: c.employeeName,
      courseTitle: c.courseTitle,
      certificateNo: c.certificateNo,
      verificationCode: c.verificationCode,
      issuedAt: c.issuedAt,
      verifyBaseUrl: origin,
    });
    const filename = `sertifikat-${c.verificationCode}.pdf`;
    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return problem(err, '/api/v1/certificates/verify/[code]/pdf');
  }
}
