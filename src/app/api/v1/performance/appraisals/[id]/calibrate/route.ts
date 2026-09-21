import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as appraisalService from '@/lib/services/appraisalService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

const CalibrateSchema = z.object({
  calibration_notes: z.string().optional(),
});

// PUT /api/v1/performance/appraisals/:id/calibrate
// PRD §11.2 — Pengesahan nilai akhir oleh Komite Kalibrasi Kinerja
// PRD §6.2 — Immutability of Final Scores
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession(req);
    const { id } = params;

    let notes = 'Dikalibrasi oleh Komite Kinerja';
    try {
      const body = await parseBody(req, CalibrateSchema);
      if (body.calibration_notes) notes = body.calibration_notes;
    } catch {
      // Body is optional
    }

    const calibrated = await appraisalService.calibrateAppraisal(db, session, id, notes);

    return ok({
      message: 'Nilai penilaian berhasil disahkan oleh Komite Kalibrasi dan telah dikunci.',
      appraisal: calibrated,
      immutability_note: 'Nilai ini telah disahkan dan dikunci. Tidak dapat diubah tanpa persetujuan berjenjang Direktur HR (PRD §6.2).',
    });
  } catch (err) {
    return problem(err, `/api/v1/performance/appraisals/${params.id}/calibrate`);
  }
}
