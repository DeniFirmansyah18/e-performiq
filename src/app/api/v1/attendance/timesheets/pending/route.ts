import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { listPendingTimesheets } from '@/lib/services/attendanceLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/attendance/timesheets/pending — timesheet tim menunggu approval (atasan)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'attendance:approve');
    if (!session.employeeId) return ok({ timesheets: [] });
    const timesheets = await listPendingTimesheets(db, session.employeeId);
    return ok({ timesheets });
  } catch (err) {
    return problem(err, '/api/v1/attendance/timesheets/pending');
  }
}
