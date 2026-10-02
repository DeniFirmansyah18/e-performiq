import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { checkIn, checkOut, listLogs } from '@/lib/services/attendanceLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Geo = z.object({ lat: z.number().optional(), lng: z.number().optional() }).optional();
const ActionSchema = z.object({
  action: z.enum(['check-in', 'check-out']),
  workDate: z.string().max(10).optional(),
  photoUrl: z.string().max(1000).optional(),
  note: z.string().max(500).optional(),
  geo: Geo,
});

// GET /api/v1/attendance/clock — log absensi karyawan yang login (30 terbaru)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'attendance:read');
    if (!session.employeeId) return ok({ logs: [] });
    const logs = await listLogs(db, session.employeeId, 30);
    return ok({ logs });
  } catch (err) {
    return problem(err, '/api/v1/attendance/clock');
  }
}

// POST /api/v1/attendance/clock — check-in / check-out (foto + lokasi)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'attendance:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);

    const body = await req.json().catch(() => ({}));
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Data absensi tidak valid.', 400);
    const { action, workDate, photoUrl, note, geo } = parsed.data;

    if (action === 'check-in') {
      const row = await checkIn(db, { employeeId: session.employeeId, workDate, photoUrl, note, geo });
      return ok(row, 'Check-in berhasil.');
    }
    const row = await checkOut(db, { employeeId: session.employeeId, workDate, photoUrl, note, geo });
    return ok(row, 'Check-out berhasil.');
  } catch (err) {
    if (err instanceof Error && /check-in|check-out/i.test(err.message)) {
      return fail('BUSINESS_RULE', err.message, 422);
    }
    return problem(err, '/api/v1/attendance/clock');
  }
}
