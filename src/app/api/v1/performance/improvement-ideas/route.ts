import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as improvementService from '@/lib/services/improvementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  employee_id: z.string().optional(),
  period_id: z.string().optional(),
  title: z.string().min(1, 'title wajib diisi'),
  description: z.string().optional(),
  estimated_saving_idr: z.number().min(0).optional(),
});

const DecideSchema = z.object({
  id: z.string().min(1, 'id wajib diisi'),
  status: z.enum(['APPROVED', 'REJECTED', 'IMPLEMENTED']),
  notes: z.string().optional(),
});

// GET /api/v1/performance/improvement-ideas?employee_id=&period_id=
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employee_id') ?? undefined;
    const periodId = searchParams.get('period_id') ?? undefined;
    const result = await improvementService.listImprovementIdeas(db, session, { employeeId, periodId });
    return ok(result);
  } catch (err) {
    return problem(err, '/api/v1/performance/improvement-ideas');
  }
}

// POST /api/v1/performance/improvement-ideas
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, CreateSchema);
    const created = await improvementService.submitImprovementIdea(db, session, {
      employeeId: body.employee_id ?? session.employeeId ?? '',
      periodId: body.period_id,
      title: body.title,
      description: body.description,
      estimatedSavingIdr: body.estimated_saving_idr,
    });
    return ok(created, 'Usulan perbaikan tersimpan.');
  } catch (err) {
    return problem(err, '/api/v1/performance/improvement-ideas');
  }
}

// PATCH /api/v1/performance/improvement-ideas (approve/reject/implement)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, DecideSchema);
    const result = await improvementService.decideImprovementIdea(
      db, session, body.id, body.status, body.notes
    );
    return ok(result, 'Status usulan diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/performance/improvement-ideas');
  }
}
