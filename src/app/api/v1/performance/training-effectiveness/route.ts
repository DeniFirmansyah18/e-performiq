import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as trainingService from '@/lib/services/trainingEffectivenessService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RecordSchema = z.object({
  enrollment_id: z.number().int().positive(),
  pre_test_score: z.number().min(0).max(100).nullable().optional(),
  post_test_score: z.number().min(0).max(100).nullable().optional(),
});

// GET /api/v1/performance/training-effectiveness?employee_id=
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employee_id') ?? session.employeeId ?? undefined;
    if (!employeeId) return ok(null, 'employee_id wajib diisi.');
    const result = await trainingService.getTrainingEffectiveness(db, session, employeeId);
    return ok(result);
  } catch (err) {
    return problem(err, '/api/v1/performance/training-effectiveness');
  }
}

// POST /api/v1/performance/training-effectiveness (simpan skor pre/post)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, RecordSchema);
    const result = await trainingService.recordTrainingScores(
      db, session, body.enrollment_id, body.pre_test_score ?? null, body.post_test_score ?? null
    );
    return ok(result, 'Skor pelatihan tersimpan.');
  } catch (err) {
    return problem(err, '/api/v1/performance/training-effectiveness');
  }
}
