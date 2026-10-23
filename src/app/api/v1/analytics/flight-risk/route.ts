import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { listFlightRisk } from '@/lib/services/flightRiskService';
import type { RiskBand } from '@/lib/engines/flightRiskEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BANDS: RiskBand[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/analytics/flight-risk — snapshot risiko terbaru per karyawan
 * (PRD v2.0 §5.4 Modul 4: Predictive Attrition & Burnout Warning).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'analytics:read');

    const { searchParams } = new URL(req.url);

    const bandParam = searchParams.get('band');
    if (bandParam !== null && BANDS.indexOf(bandParam.toUpperCase() as RiskBand) === -1) {
      return fail('VALIDATION_ERROR', `band harus salah satu dari: ${BANDS.join(', ')}.`, 400);
    }

    const departmentId = searchParams.get('department_id');
    if (departmentId !== null && !UUID.test(departmentId)) {
      return fail('VALIDATION_ERROR', 'department_id harus berupa UUID.', 400);
    }

    const limitParam = searchParams.get('limit');
    if (limitParam !== null && !/^\d+$/.test(limitParam)) {
      return fail('VALIDATION_ERROR', 'limit harus berupa bilangan bulat.', 400);
    }

    const items = await listFlightRisk(db, {
      band: bandParam ? (bandParam.toUpperCase() as RiskBand) : undefined,
      departmentId: departmentId ?? undefined,
      limit: limitParam ? Number(limitParam) : undefined,
    });

    return ok({ items, total: items.length }, 'Data risiko karyawan berhasil dimuat.');
  } catch (err) {
    return problem(err, '/api/v1/analytics/flight-risk');
  }
}
