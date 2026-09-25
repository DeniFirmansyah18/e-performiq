import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail } from '@/lib/api/response';
import { submitDailyTimesheet } from '@/lib/services/productivityService';
import { z } from 'zod';

const TimesheetSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  regularHours: z.number().min(0).max(12).optional(),
  overtimeHours: z.number().min(0).max(4, 'Lembur maksimal 4 jam per hari sesuai PP No. 35/2021').optional(),
  taskSummary: z.string().min(5, 'Ringkasan tugas minimal 5 karakter'),
});

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return fail('UNAUTHORIZED', 'Sesi tidak valid atau telah berakhir.', 401);
  }

  try {
    const body = await req.json();
    const parsed = TimesheetSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const timesheet = await submitDailyTimesheet({
      employeeId: session.employeeId,
      workDate: parsed.data.workDate,
      regularHours: parsed.data.regularHours,
      overtimeHours: parsed.data.overtimeHours,
      taskSummary: parsed.data.taskSummary,
    });

    return ok(timesheet, 'Timesheet harian berhasil dicatat.');
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal menyimpan timesheet', 500);
  }
}
