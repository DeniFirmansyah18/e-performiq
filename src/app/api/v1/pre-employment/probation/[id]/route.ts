import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as preEmpService from '@/lib/services/preEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

const ProbationSchema = z.object({
  day_30_score: z.number().min(0).max(100).optional(),
  day_60_score: z.number().min(0).max(100).optional(),
  day_90_score: z.number().min(0).max(100).optional(),
  manager_notes: z.string().optional(),
  probation_passed: z.boolean().optional(),
});

// PUT /api/v1/pre-employment/probation/:id
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession(req);
    const { id } = params;
    const body = await parseBody(req, ProbationSchema);

    const updated = await preEmpService.evaluateProbationMilestone(db, session, id, {
      day30Score: body.day_30_score,
      day60Score: body.day_60_score,
      day90Score: body.day_90_score,
      managerNotes: body.manager_notes,
      probationPassed: body.probation_passed,
    });

    return ok({
      message: 'Evaluasi berkala probation berhasil diperbarui.',
      milestone: updated,
    });
  } catch (err) {
    return problem(err, `/api/v1/pre-employment/probation/${params.id}`);
  }
}
