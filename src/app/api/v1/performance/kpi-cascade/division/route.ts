import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import { listDivisionKpis, createDivisionKpi } from '@/lib/services/kpiCascadeService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  corporate_kpi_id: z.string().min(1, 'corporate_kpi_id wajib diisi'),
  department_id: z.string().min(1, 'department_id wajib diisi'),
  kpi_title: z.string().min(1, 'kpi_title wajib diisi'),
  target_value: z.number().positive('target_value wajib lebih besar dari 0'),
  weight_pct: z.number().min(0.01).max(100, 'weight_pct antara 0-100'),
});

// GET /api/v1/performance/kpi-cascade/division
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const corporateKpiId = searchParams.get('corporate_kpi_id') ?? undefined;
    const items = await listDivisionKpis(db, corporateKpiId);
    return ok({ items, total: items.length });
  } catch (err) {
    return failFromError(err, 'Gagal memuat KPI divisi.');
  }
}

// POST /api/v1/performance/kpi-cascade/division
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const data = await parseBody(req, CreateSchema);
    const created = await createDivisionKpi(db, {
      userId: session.userId,
      employeeId: session.employeeId,
      role: session.role,
    }, {
      corporateKpiId: data.corporate_kpi_id,
      departmentId: data.department_id,
      kpiTitle: data.kpi_title,
      targetValue: data.target_value,
      weightPct: data.weight_pct,
    });
    return ok(created, 'KPI divisi diturunkan dari KPI korporat.');
  } catch (err) {
    return failFromError(err, 'Gagal membuat KPI divisi.');
  }
}
