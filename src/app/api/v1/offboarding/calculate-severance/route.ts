import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as offboardingService from '@/lib/services/offboardingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CalculateSeveranceSchema = z.object({
  offboarding_request_id: z.string().min(1, 'offboarding_request_id wajib diisi'),
  reason_type: z.enum(['RESIGNATION', 'PENSION', 'EFFICIENCY', 'CONTRACT_END']).default('RESIGNATION'),
  dplk_topup: z.number().min(0).optional().default(0),
});

// POST /api/v1/offboarding/calculate-severance
// PRD §11.2 & §8: Menghitung pesangon PP 35/2021 dengan verifikasi clearance 100%
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, CalculateSeveranceSchema);

    const result = await offboardingService.calculateOffboardingSeverance(
      db,
      session,
      body.offboarding_request_id,
      body.reason_type,
      body.dplk_topup
    );

    const total = Number(result.totalDisbursement ?? result.breakdown?.totalDisbursement ?? 0);

    return ok({
      ...result,
      totalDisbursement: total,
      total_disbursement_idr: total,
      message: 'Kalkulasi pesangon PP 35/2021 berhasil dihitung & disahkan (Clearance 100% Terverifikasi).',
      data: {
        ...result,
        totalDisbursement: total,
        total_disbursement_idr: total,
      },
    });
  } catch (err) {
    return problem(err, '/api/v1/offboarding/calculate-severance');
  }
}
