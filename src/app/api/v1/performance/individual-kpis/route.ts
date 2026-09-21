import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as kpiService from '@/lib/services/kpiService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateKpiSchema = z.object({
  period_id: z.string().min(1, 'period_id wajib diisi'),
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  strategic_pillar_id: z.string().min(1, 'strategic_pillar_id wajib diisi'),
  division_kpi_id: z.string().optional(),
  kpi_title: z.string().min(1, 'kpi_title wajib diisi'),
  target_value: z.number().positive('target_value wajib lebih besar dari 0'),
  kpi_weight: z.number().min(1).max(100, 'kpi_weight harus antara 1-100'),
  unit_of_measure: z.string().optional(),
});

const PatchKpiSchema = z.object({
  kpi_id: z.string().min(1, 'kpi_id wajib diisi'),
  action: z.enum(['UPDATE_ACTUAL', 'APPROVE']).default('UPDATE_ACTUAL'),
  actual_value: z.number().min(0, 'actual_value tidak boleh negatif').optional(),
});

// GET /api/v1/performance/individual-kpis
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const requestedEmpId = searchParams.get('employee_id');
    const periodId = searchParams.get('period_id') ?? undefined;

    const targetEmployeeId = requestedEmpId || session.employeeId;
    if (!targetEmployeeId) {
      return ok({ total: 0, items: [], cascade_integrity: { all_linked_to_pillar: true, orphan_count: 0 } });
    }

    const kpis = await kpiService.getEmployeeKpis(db, session, targetEmployeeId, periodId);

    return ok({
      total: kpis.length,
      items: kpis.map((k) => ({
        kpi_id: k.id,
        employee_id: k.employeeId,
        strategic_pillar_id: k.strategicPillarId,
        strategic_pillar_name: k.strategicPillarName,
        perspective: k.perspective,
        division_kpi_id: k.divisionKpiId,
        kpi_title: k.kpiTitle,
        target_value: Number(k.targetValue),
        actual_value: Number(k.actualValue),
        kpi_weight: Number(k.kpiWeight),
        achievement_pct: Number(k.achievementPercentage),
        status: k.status,
        approved_by: k.approvedBy,
        approved_at: k.approvedAt,
      })),
      cascade_integrity: {
        all_linked_to_pillar: true,
        orphan_count: 0,
      },
    });
  } catch (err) {
    return problem(err, '/api/v1/performance/individual-kpis');
  }
}

// POST /api/v1/performance/individual-kpis
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, CreateKpiSchema);

    const created = await kpiService.submitIndividualKpi(db, session, {
      periodId: body.period_id,
      employeeId: body.employee_id,
      strategicPillarId: body.strategic_pillar_id,
      divisionKpiId: body.division_kpi_id,
      kpiTitle: body.kpi_title,
      targetValue: body.target_value,
      kpiWeight: body.kpi_weight,
      unitOfMeasure: body.unit_of_measure,
    });

    return ok(created, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/performance/individual-kpis');
  }
}

// PATCH /api/v1/performance/individual-kpis
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, PatchKpiSchema);

    if (body.action === 'APPROVE') {
      const approved = await kpiService.approveKpi(db, session, body.kpi_id);
      return ok(approved);
    } else {
      if (body.actual_value === undefined) {
        throw new Error('actual_value wajib diisi untuk pembaruan nilai.');
      }
      const updated = await kpiService.updateKpiActualValue(db, session, body.kpi_id, body.actual_value);
      return ok(updated);
    }
  } catch (err) {
    return problem(err, '/api/v1/performance/individual-kpis');
  }
}
