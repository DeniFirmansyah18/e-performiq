import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import { listCorporateKpis, createCorporateKpi } from '@/lib/services/kpiCascadeService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  pillar_id: z.string().min(1, 'pillar_id wajib diisi'),
  period_year: z.number().int().min(2000).max(2100),
  kpi_name: z.string().min(1, 'kpi_name wajib diisi'),
  target_value: z.number().positive('target_value wajib lebih besar dari 0'),
  unit_of_measure: z.string().default('%'),
  kpi_code: z.string().min(1, 'kpi_code wajib diisi'),
});

// GET /api/v1/performance/kpi-cascade/corporate
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const periodYear = searchParams.get('period_year')
      ? Number(searchParams.get('period_year'))
      : undefined;
    const items = await listCorporateKpis(db, periodYear);
    return ok({ items, total: items.length, role: session.role });
  } catch (err) {
    return failFromError(err, 'Gagal memuat KPI korporat.');
  }
}

// POST /api/v1/performance/kpi-cascade/corporate
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const data = await parseBody(req, CreateSchema);
    const created = await createCorporateKpi(db, {
      userId: session.userId,
      employeeId: session.employeeId,
      role: session.role,
    }, {
      pillarId: data.pillar_id,
      periodYear: data.period_year,
      kpiName: data.kpi_name,
      targetValue: data.target_value,
      unitOfMeasure: data.unit_of_measure || '%',
      kpiCode: data.kpi_code,
    });
    return ok(created, `KPI korporat ${created.kpiCode} ditetapkan.`);
  } catch (err) {
    return failFromError(err, 'Gagal membuat KPI korporat.');
  }
}
