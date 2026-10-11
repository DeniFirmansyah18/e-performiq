import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as sopService from '@/lib/services/sopComplianceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpsertSchema = z.object({
  period_id: z.string().min(1, 'period_id wajib diisi'),
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  total_assigned_tasks: z.number().int().min(0),
  tasks_on_time: z.number().int().min(0),
  error_count: z.number().int().min(0),
  fatal_error_count: z.number().int().min(0),
  audit_findings_count: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

// GET /api/v1/performance/sop-compliance?period_id=&employee_id=
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('period_id');
    const employeeId = searchParams.get('employee_id');

    if (!periodId) {
      return ok({ total: 0, items: [] }, 'period_id wajib diisi.');
    }

    if (employeeId) {
      const metrics = await sopService.getSopMetrics(db, employeeId, periodId);
      return ok(metrics);
    }

    const items = await sopService.listSopMetrics(db, session, periodId);
    return ok({ total: items.length, items });
  } catch (err) {
    return problem(err, '/api/v1/performance/sop-compliance');
  }
}

// POST /api/v1/performance/sop-compliance (upsert manual HR/manager)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, UpsertSchema);

    const saved = await sopService.upsertSopMetrics(db, session, {
      periodId: body.period_id,
      employeeId: body.employee_id,
      totalAssignedTasks: body.total_assigned_tasks,
      tasksOnTime: body.tasks_on_time,
      errorCount: body.error_count,
      fatalErrorCount: body.fatal_error_count,
      auditFindingsCount: body.audit_findings_count,
      notes: body.notes,
    });

    return ok(saved, 'Metrik kepatuhan SOP tersimpan.');
  } catch (err) {
    return problem(err, '/api/v1/performance/sop-compliance');
  }
}
