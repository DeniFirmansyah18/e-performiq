import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import { BusinessRuleError } from '@/lib/auth/errors';
import * as kpiIndicatorService from '@/lib/services/kpiIndicatorService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTION = z.enum(['HIGHER_BETTER', 'LOWER_BETTER']);
const FREQUENCY = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);
const AGGREGATION = z.enum(['SUM', 'AVG', 'LAST', 'MAX']);

const CreateSchema = z.object({
  kpi_id: z.string().min(1, 'kpi_id wajib diisi'),
  indicator_name: z.string().min(1, 'indicator_name wajib diisi'),
  unit_of_measure: z.string().min(1).max(50).optional(),
  target_value: z.number().positive('target_value wajib lebih besar dari 0'),
  direction: DIRECTION.optional(),
  frequency: FREQUENCY.optional(),
  aggregation: AGGREGATION.optional(),
  indicator_weight: z.number().min(1).max(100).optional(),
});

const PatchSchema = z.object({
  indicator_id: z.string().min(1, 'indicator_id wajib diisi'),
  indicator_name: z.string().min(1).optional(),
  unit_of_measure: z.string().min(1).max(50).optional(),
  target_value: z.number().positive().optional(),
  direction: DIRECTION.optional(),
  frequency: FREQUENCY.optional(),
  aggregation: AGGREGATION.optional(),
  indicator_weight: z.number().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
});

// GET /api/v1/performance/kpi-indicators?kpi_id= | employee_id=[&period_id=]
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const kpiId = searchParams.get('kpi_id');
    const employeeId = searchParams.get('employee_id') ?? session.employeeId ?? undefined;
    const periodId = searchParams.get('period_id') ?? undefined;

    if (kpiId) {
      const items = await kpiIndicatorService.listIndicatorsForKpi(db, session, kpiId);
      return ok({ items });
    }
    if (!employeeId) return ok({ items: [] });

    const items = await kpiIndicatorService.listIndicatorsForEmployee(db, session, employeeId, periodId);
    return ok({ items });
  } catch (err) {
    return problem(err, '/api/v1/performance/kpi-indicators');
  }
}

// POST /api/v1/performance/kpi-indicators
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, CreateSchema);
    const created = await kpiIndicatorService.createIndicator(db, session, {
      kpiId: body.kpi_id,
      indicatorName: body.indicator_name,
      unitOfMeasure: body.unit_of_measure,
      targetValue: body.target_value,
      direction: body.direction,
      frequency: body.frequency,
      aggregation: body.aggregation,
      indicatorWeight: body.indicator_weight,
    });
    return ok({ indicator: created }, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/performance/kpi-indicators');
  }
}

// PATCH /api/v1/performance/kpi-indicators
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, PatchSchema);
    const updated = await kpiIndicatorService.patchIndicator(db, session, body.indicator_id, {
      indicatorName: body.indicator_name,
      unitOfMeasure: body.unit_of_measure,
      targetValue: body.target_value,
      direction: body.direction,
      frequency: body.frequency,
      aggregation: body.aggregation,
      indicatorWeight: body.indicator_weight,
      isActive: body.is_active,
    });
    return ok({ indicator: updated }, 'Indikator harian diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/performance/kpi-indicators');
  }
}

// DELETE /api/v1/performance/kpi-indicators?indicator_id=
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const indicatorId = searchParams.get('indicator_id');
    if (!indicatorId) {
      throw new BusinessRuleError('indicator_id wajib diisi.');
    }
    await kpiIndicatorService.removeIndicator(db, session, indicatorId);
    return ok(null, 'Indikator harian dihapus.');
  } catch (err) {
    return problem(err, '/api/v1/performance/kpi-indicators');
  }
}
