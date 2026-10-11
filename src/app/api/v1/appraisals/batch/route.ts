import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem, parseBody } from '@/lib/api/response';
import {
  enqueueGpaBatch,
  listGpaBatchJobs,
  getGpaBatchJob,
} from '@/lib/services/gpaBatchService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const enqueueSchema = z.object({ periodId: z.string().uuid() });

// GET /api/v1/appraisals/batch — daftar job batch GPA terbaru
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'appraisal:calculate');

    const jobId = req.nextUrl.searchParams.get('jobId');
    if (jobId) {
      const job = await getGpaBatchJob(db, jobId);
      return ok({ job });
    }
    const jobs = await listGpaBatchJobs(db, 20);
    return ok({ jobs });
  } catch (err) {
    return problem(err, '/api/v1/appraisals/batch');
  }
}

// POST /api/v1/appraisals/batch — antre kalkulasi GPA massal untuk satu periode
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'appraisal:batch');

    const { periodId } = await parseBody(req, enqueueSchema);
    const result = await enqueueGpaBatch(db, { periodId, createdBy: session.userId });
    return ok(result, { status: 202 });
  } catch (err) {
    return problem(err, '/api/v1/appraisals/batch');
  }
}
