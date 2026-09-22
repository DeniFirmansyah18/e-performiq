import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem, parseBody } from '@/lib/api/response';
import * as offboardingService from '@/lib/services/offboardingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const InitiateSchema = z.object({
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  reason_for_leaving: z.string().min(1, 'reason_for_leaving wajib diisi'),
  resignation_notice_date: z.string().min(1, 'resignation_notice_date wajib diisi'),
  last_working_day: z.string().min(1, 'last_working_day wajib diisi'),
  is_regrettable_attrition: z.boolean().optional(),
});

// GET /api/v1/offboarding/initiate — Ambil daftar proses offboarding & clearance aktif
export async function GET(req: NextRequest) {
  try {
    await getAuthSession(req);
    const list = await offboardingService.getOffboardingList(db);
    return ok(list);
  } catch (err) {
    return problem(err, '/api/v1/offboarding/initiate');
  }
}

// POST /api/v1/offboarding/initiate
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await parseBody(req, InitiateSchema);

    const created = await offboardingService.createOffboardingRequest(db, session, {
      employeeId: body.employee_id,
      reasonForLeaving: body.reason_for_leaving,
      resignationNoticeDate: body.resignation_notice_date,
      lastWorkingDay: body.last_working_day,
      isRegrettableAttrition: body.is_regrettable_attrition,
    });

    return ok({
      message: 'Proses offboarding dan aktivasi checklist clearance berhasil diinisiasi.',
      data: created,
    }, { status: 201 });
  } catch (err) {
    return problem(err, '/api/v1/offboarding/initiate');
  }
}
