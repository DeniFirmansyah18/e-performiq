import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { recomputeAllRisks } from '@/lib/services/flightRiskService';
import { logAction } from '@/lib/services/auditService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Tanggal hari ini menurut zona waktu kantor (WIB). */
function todayJakarta(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/**
 * POST /api/v1/analytics/flight-risk/recompute — hitung ulang risiko seluruh
 * karyawan aktif untuk satu tanggal (idempoten). Dijalankan HR, bukan
 * dijadwalkan otomatis, agar beban query tetap terkendali.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'analytics:manage');

    let body: { as_of?: unknown } = {};
    try {
      body = (await req.json()) as { as_of?: unknown };
    } catch {
      body = {};
    }

    const asOf = body.as_of === undefined ? todayJakarta() : body.as_of;
    if (typeof asOf !== 'string' || !ISO_DATE.test(asOf)) {
      return fail('VALIDATION_ERROR', 'as_of harus berformat YYYY-MM-DD.', 400);
    }

    const result = await recomputeAllRisks(db, asOf);

    await logAction(db, {
      userId: session.userId,
      actionType: 'UPDATE',
      entityName: 'employee_flight_risk_snapshots',
      recordId: asOf,
      description: `Hitung ulang risiko karyawan untuk ${asOf}: ${result.processed} diproses, ${result.skipped} dilewati.`,
    });

    return ok({ ...result, asOf }, 'Perhitungan risiko selesai.');
  } catch (err) {
    return problem(err, '/api/v1/analytics/flight-risk/recompute');
  }
}
