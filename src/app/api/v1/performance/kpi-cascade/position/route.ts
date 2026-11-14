import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import { listPositionKpis, createPositionKpi } from '@/lib/services/kpiCascadeService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  manager_kpi_id: z.string().optional().nullable(),
  position_id: z.string().min(1, 'position_id wajib diisi'),
  kpi_title: z.string().min(1, 'kpi_title wajib diisi'),
  target_value: z.number().positive('target_value wajib lebih besar dari 0'),
  unit_of_measure: z.string().default('%'),
  weight_pct: z.number().min(0.01).max(100, 'weight_pct antara 0-100'),
});

// GET /api/v1/performance/kpi-cascade/position
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const managerKpiId = searchParams.get('manager_kpi_id') ?? undefined;
    const items = await listPositionKpis(db, managerKpiId);
    return ok({ items, total: items.length });
  } catch (err) {
    return failFromError(err, 'Gagal memuat KPI posisi.');
  }
}

// POST /api/v1/performance/kpi-cascade/position
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const data = await parseBody(req, CreateSchema);
    const created = await createPositionKpi(db, {
      userId: session.userId,
      employeeId: session.employeeId,
      role: session.role,
    }, {
      managerKpiId: data.manager_kpi_id ?? null,
      positionId: data.position_id,
      kpiTitle: data.kpi_title,
      targetValue: data.target_value,
      unitOfMeasure: data.unit_of_measure || '%',
      weightPct: data.weight_pct,
    });
    return ok(created, 'KPI posisi diturunkan dari KPI People Manager.');
  } catch (err) {
    return failFromError(err, 'Gagal membuat KPI posisi.');
  }
}
