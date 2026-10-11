import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import { BusinessRuleError } from '@/lib/auth/errors';
import * as analyticsService from '@/lib/services/analyticsService';
import * as coreValuesService from '@/lib/services/coreValuesService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/360-reviews?period_id=&employee_id=
// Mengembalikan AGREGAT anonim + jumlah reviewer per kelompok (tanpa identitas).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('period_id');
    const employeeId = searchParams.get('employee_id') ?? session.employeeId ?? undefined;

    if (!periodId || !employeeId) {
      return ok(null, 'period_id dan employee_id wajib diisi.');
    }

    const agg = await coreValuesService.get360ForSession(db, session, employeeId, periodId);
    return ok({ employeeId, periodId, ...agg });
  } catch (err) {
    return problem(err, '/api/v1/performance/360-reviews');
  }
}

const Review360Schema = z.object({
  period_id: z.string().min(1, 'period_id wajib diisi'),
  evaluatee_id: z.string().min(1, 'evaluatee_id wajib diisi'),
  relationship_type: z.enum(['SUPERVISOR', 'PEER', 'SUBORDINATE']),
  integrity_score: z.number().min(1).max(5),
  collaboration_score: z.number().min(1).max(5),
  innovation_score: z.number().min(1).max(5),
  feedback_notes: z.string().optional(),
});

// POST /api/v1/performance/360-reviews
// PRD §11.2 — Mengirimkan review rekan kerja terenkripsi dan anonim
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, Review360Schema);

    // Prevent self-evaluation
    if (body.evaluatee_id === session.employeeId) {
      throw new BusinessRuleError('Karyawan tidak diperbolehkan mengevaluasi dirinya sendiri.');
    }

    const created = await analyticsService.submitPeerReview360(db, session, {
      periodId: body.period_id,
      evaluateeId: body.evaluatee_id,
      relationshipType: body.relationship_type,
      integrityScore: body.integrity_score,
      collaborationScore: body.collaboration_score,
      innovationScore: body.innovation_score,
      feedbackNotes: body.feedback_notes,
    });

    return ok({
      message: 'Review 360° berhasil disimpan secara anonim & terenkripsi ke database.',
      data: created,
    }, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/performance/360-reviews');
  }
}
