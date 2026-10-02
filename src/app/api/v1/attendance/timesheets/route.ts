import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { submitTimesheet, listTimesheets } from '@/lib/services/attendanceLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TimesheetSchema = z.object({
  workDate: z.string().min(8).max(10),
  regularHours: z.number().min(0).max(12).optional(),
  overtimeHours: z.number().min(0).max(4).optional(),
  taskSummary: z.string().min(3).max(2000),
  activityCategory: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  photos: z.array(z.string().max(1000)).max(5).optional(),
});

// GET /api/v1/attendance/timesheets — timesheet karyawan yang login
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'attendance:read');
    if (!session.employeeId) return ok({ timesheets: [] });
    const timesheets = await listTimesheets(db, session.employeeId, 30);
    return ok({ timesheets });
  } catch (err) {
    return problem(err, '/api/v1/attendance/timesheets');
  }
}

// POST /api/v1/attendance/timesheets — submit timesheet harian (foto + kategori)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'attendance:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);

    const body = await req.json().catch(() => ({}));
    const parsed = TimesheetSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data timesheet tidak valid.', 400);

    const row = await submitTimesheet(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, 'Timesheet dikirim untuk persetujuan atasan.');
  } catch (err) {
    if (err instanceof Error && /lembur/i.test(err.message)) {
      return fail('BUSINESS_RULE', err.message, 422);
    }
    return problem(err, '/api/v1/attendance/timesheets');
  }
}
