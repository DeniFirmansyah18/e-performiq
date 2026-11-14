import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import { listManagerKpis, createManagerKpi } from '@/lib/services/kpiCascadeService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  division_kpi_id: z.string().min(1, 'division_kpi_id wajib diisi'),
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  kpi_title: z.string().min(1, 'kpi_title wajib diisi'),
  target_value: z.number().positive('target_value wajib lebih besar dari 0'),
  unit_of_measure: z.string().default('%'),
  weight_pct: z.number().min(0.01).max(100, 'weight_pct antara 0-100'),
});

// GET /api/v1/performance/kpi-cascade/manager
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const divisionKpiId = searchParams.get('division_kpi_id') ?? undefined;
    const items = await listManagerKpis(db, divisionKpiId);
    return ok({ items, total: items.length });
  } catch (err) {
    return failFromError(err, 'Gagal memuat KPI People Manager.');
  }
}

// POST /api/v1/performance/kpi-cascade/manager
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const data = await parseBody(req, CreateSchema);
    const created = await createManagerKpi(db, {
      userId: session.userId,
      employeeId: session.employeeId,
      role: session.role,
    }, {
      divisionKpiId: data.division_kpi_id,
      employeeId: data.employee_id,
      kpiTitle: data.kpi_title,
      targetValue: data.target_value,
      unitOfMeasure: data.unit_of_measure || '%',
      weightPct: data.weight_pct,
    });
    return ok(created, 'KPI People Manager diturunkan dari KPI divisi.');
  } catch (err) {
    return failFromError(err, 'Gagal membuat KPI People Manager.');
  }
}
