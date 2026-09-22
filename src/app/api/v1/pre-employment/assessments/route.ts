import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as preEmpService from '@/lib/services/preEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AssessmentSchema = z.object({
  candidate_name: z.string().min(1, 'candidate_name wajib diisi'),
  applied_position_id: z.string().min(1, 'applied_position_id wajib diisi'),
  hiring_requisition_id: z.string().min(1, 'hiring_requisition_id wajib diisi'),
  psychometric_score: z.number().min(0).max(100),
  technical_test_score: z.number().min(0).max(100),
  competency_interview_score: z.number().min(0).max(100),
  recruitment_cost: z.number().min(0).optional(),
  time_to_fill_days: z.number().min(0).optional(),
  hiring_status: z.string().optional(),
});

// POST /api/v1/pre-employment/assessments
// PRD §11.2 — Mencatat skor seleksi & kalkulasi Quality of Hire (QoH)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, AssessmentSchema);

    const created = await preEmpService.registerCandidateAssessment(db, session, {
      candidateName: body.candidate_name,
      appliedPositionId: body.applied_position_id,
      hiringRequisitionId: body.hiring_requisition_id,
      psychometricScore: body.psychometric_score,
      technicalTestScore: body.technical_test_score,
      competencyInterviewScore: body.competency_interview_score,
      recruitmentCost: body.recruitment_cost,
      timeToFillDays: body.time_to_fill_days,
      hiringStatus: body.hiring_status,
      computedQohScore: 0,
    });

    return ok(created, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/pre-employment/assessments');
  }
}
